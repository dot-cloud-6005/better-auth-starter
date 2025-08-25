"use client";

// Avoid static generation for this route, it relies on browser APIs
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Augment window for optional offline cache helpers (injected elsewhere)
declare global {
  interface Window {
    navCache?: {
      getInspections?: (asset: number) => InspectionRecord[] | undefined;
      setInspections?: (asset: number, rows: InspectionRecord[]) => void;
      getEquipment?: (asset: number) => EquipmentRecord[] | undefined;
      setEquipment?: (asset: number, rows: EquipmentRecord[]) => void;
    };
  }
}
import type { InspectionRecord, EquipmentRecord } from "@/types/navapp";
import type { Asset } from "@/types/asset";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { performNavigationSync, getNavigationDataForMap, hasNavigationData } from "@/lib/navigation-sync";
import { getCachedAssetImage } from '@/lib/client-db/sqlite';
import {
  Map as ReactMap,
  Source,
  Layer,
  Marker as RglMarker,
  NavigationControl,
  type MapRef,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapClickEvent = {
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: GeoJSON.Geometry;
  }>;
};

export default function MapPage() {
  const mapRef = useRef<MapRef | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<"amber" | "auto">("amber");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [tab, setTab] = useState<"asset" | "inspect" | "equipment">("asset");
  const [insp, setInsp] = useState<InspectionRecord[] | null>(null);
  const [inspSource, setInspSource] = useState<'db' | 'json' | 'none' | null>(null);
  const [equip, setEquip] = useState<EquipmentRecord[] | null>(null);
  const [equipSource, setEquipSource] = useState<'db' | 'json' | 'none' | null>(null);
  const [inspLoading, setInspLoading] = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);
  const [inspError, setInspError] = useState<string | null>(null);
  const [equipError, setEquipError] = useState<string | null>(null);
  // manual fetch triggers (increment to signal refresh while preventing auto fetch on tab switch)
  const [inspFetchVersion, setInspFetchVersion] = useState(0);
  const [equipFetchVersion, setEquipFetchVersion] = useState(0);
  const fetchedInspFor = useRef<number | null>(null);
  const fetchedEquipFor = useRef<number | null>(null);
  const assetsRef = useRef<Asset[]>([]);
  const userPosRef = useRef<{ lon: number; lat: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  
  // Navigation sync state
  const [navigationSyncLoading, setNavigationSyncLoading] = useState(false);
  const [navigationSyncError, setNavigationSyncError] = useState<string | null>(null);
  const [offlineAssetsCount, setOfflineAssetsCount] = useState(0);
  const [offlineInspectionsCount, setOfflineInspectionsCount] = useState(0);
  
  // Full-screen inspection viewer state
  const [showInspectionViewer, setShowInspectionViewer] = useState(false);
  const [currentInspectionIndex, setCurrentInspectionIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Image lightbox state
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Collect all images for the current inspection session
  const getAllInspectionImages = () => {
    const allImages: string[] = [];
    
    if (insp && Array.isArray(insp)) {
      insp.forEach((inspection: InspectionRecord) => {
        if (inspection["Main Asset Photo"]) {
          allImages.push(inspection["Main Asset Photo"]);
        }
        for (let i = 1; i <= 6; i++) {
          const additionalPhoto = inspection[`Additional #${i}` as keyof InspectionRecord];
          if (additionalPhoto) {
            allImages.push(additionalPhoto as string);
          }
        }
      });
    }
    return allImages;
  };

  const openImageLightbox = (imagePath: string) => {
    const allImages = getAllInspectionImages();
    const imageIndex = allImages.indexOf(imagePath);
    setLightboxImages(allImages);
    setCurrentImageIndex(imageIndex >= 0 ? imageIndex : 0);
    setShowImageLightbox(true);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentImageIndex(prev => prev > 0 ? prev - 1 : lightboxImages.length - 1);
    } else {
      setCurrentImageIndex(prev => prev < lightboxImages.length - 1 ? prev + 1 : 0);
    }
  };

  const closeLightbox = () => {
    setShowImageLightbox(false);
    setLightboxImages([]);
    setCurrentImageIndex(0);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!showImageLightbox) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      } else if (e.key === 'ArrowRight') {
        navigateImage('next');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageLightbox, lightboxImages.length]);

  // Touch handlers for lightbox swipe
  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleLightboxTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleLightboxTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Swiped left - next image
        navigateImage('next');
      } else {
        // Swiped right - previous image
        navigateImage('prev');
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Get the newest main photo from cache or inspections for the selected asset
  const getNewestMainPhoto = async (): Promise<string | null> => {
    if (!selected) return null;

    try {
      // First, try to get the cached image
      const cachedImage = await getCachedAssetImage(selected.Asset_Number);
      if (cachedImage) {
        return cachedImage;
      }
    } catch (error) {
      console.warn('Failed to get cached image, falling back to inspection search:', error);
    }

    // Fallback: search through inspections manually
    if (!insp || !Array.isArray(insp)) return null;

    // Filter inspections that have main photos and sort by date (newest first)
    const inspectionsWithPhotos = insp
      .filter((inspection: InspectionRecord) => inspection["Main Asset Photo"])
      .sort((a: InspectionRecord, b: InspectionRecord) => {
        // Try to parse dates from various possible date fields
        const getInspectionDate = (insp: InspectionRecord) => {
          const dateFields = ['Date', 'Inspection Date', 'date', 'Date_Time'];
          for (const field of dateFields) {
            const dateValue = insp[field as keyof InspectionRecord];
            if (dateValue) {
              const date = new Date(dateValue as string);
              if (!isNaN(date.getTime())) {
                return date;
              }
            }
          }
          return new Date(0); // Fallback to epoch if no valid date found
        };

        const dateA = getInspectionDate(a);
        const dateB = getInspectionDate(b);
        return dateB.getTime() - dateA.getTime(); // Newest first
      });

    return inspectionsWithPhotos.length > 0 ? (inspectionsWithPhotos[0]["Main Asset Photo"] || null) : null;
  };

  // State for the newest main photo (cached)
  const [newestMainPhoto, setNewestMainPhoto] = useState<string | null>(null);

  // Update the newest main photo when selected asset changes
  useEffect(() => {
    if (selected) {
      getNewestMainPhoto().then(setNewestMainPhoto);
    } else {
      setNewestMainPhoto(null);
    }
  }, [selected?.Asset_Number, insp]); // Re-run when asset or inspections change

  // Initialize Mapbox CSP-compatible worker when strict CSP is in effect
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      try {
        const mapboxMod = await import("mapbox-gl");
        type GLWithWorker = { workerClass?: unknown };
        const maybeDefault = (mapboxMod as unknown as { default?: GLWithWorker }).default;
        const gl: GLWithWorker = maybeDefault ?? (mapboxMod as unknown as GLWithWorker);
        if (!gl.workerClass) {
          const workerMod = await import("mapbox-gl/dist/mapbox-gl-csp-worker");
          const workerDefault = (workerMod as unknown as { default?: unknown }).default;
          if (!cancelled && workerDefault) {
            gl.workerClass = workerDefault;
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Navigation sync - check and perform initial sync on component mount
  useEffect(() => {
    let cancelled = false;
    
    // Set up window.navCache interface for navigation inspections and equipment
    if (typeof window !== 'undefined') {
      window.navCache = {
        getInspections: (assetNumber: number) => {
          // This will be populated by the inspection tab refresh logic
          return undefined;
        },
        setInspections: (assetNumber: number, rows: InspectionRecord[]) => {
          // Cache logic would go here if needed
          console.log(`Caching ${rows.length} inspections for asset ${assetNumber}`);
        },
        getEquipment: (assetNumber: number) => {
          // This will be populated by the equipment tab refresh logic  
          return undefined;
        },
        setEquipment: (assetNumber: number, rows: EquipmentRecord[]) => {
          // Cache logic would go here if needed
          console.log(`Caching ${rows.length} equipment records for asset ${assetNumber}`);
        }
      };
    }
    
    const checkAndSync = async () => {
      try {
        // Check if we have navigation data locally
        const hasData = await hasNavigationData();
        
        if (!hasData || navigator.onLine) {
          // If no local data or we're online, perform sync
          setNavigationSyncLoading(true);
          setNavigationSyncError(null);
          
          const result = await performNavigationSync();
          
          if (!cancelled) {
            if (result.error) {
              setNavigationSyncError(result.error);
              console.warn('Navigation sync failed:', result.error);
            } else {
              console.log(`Navigation sync complete: ${result.assetsUpdated} assets, ${result.inspectionsUpdated} inspections, ${result.imagesCached || 0} images cached`);
              // Reload assets from navigation sync to show all synced data immediately
              await reloadAssetsFromNavigation();
            }
            
            // Update counts regardless of sync success (to show what's available offline)
            const offlineData = await getNavigationDataForMap();
            setOfflineAssetsCount(offlineData.assets.length);
            setOfflineInspectionsCount(offlineData.inspections.length);
          }
        } else {
          // We have data but we're offline, just get counts
          const offlineData = await getNavigationDataForMap();
          setOfflineAssetsCount(offlineData.assets.length);
          setOfflineInspectionsCount(offlineData.inspections.length);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Navigation sync failed';
          setNavigationSyncError(message);
          console.error('Navigation sync error:', error);
        }
      } finally {
        if (!cancelled) {
          setNavigationSyncLoading(false);
        }
      }
    };
    
    checkAndSync();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Manual navigation sync trigger
  const triggerNavigationSync = async () => {
    setNavigationSyncLoading(true);
    setNavigationSyncError(null);
    
    try {
      // Force a full sync by clearing the sync state
      const { clearNavigationSyncState } = await import('@/lib/navigation-sync');
      clearNavigationSyncState();
      
      const result = await performNavigationSync();
      
      if (result.error) {
        setNavigationSyncError(result.error);
      } else {
        const messages = [
          `${result.assetsUpdated} assets updated`,
          `${result.inspectionsUpdated} inspections updated`
        ];
        
        if (result.imagesCached !== undefined) {
          messages.push(`${result.imagesCached} images cached`);
        }
        
        if (result.jsonInspectionsLoaded) {
          messages.push(`${result.jsonInspectionsLoaded} inspections loaded from JSON`);
        }
        
        console.log(`Manual navigation sync complete: ${messages.join(', ')}`);
        
        // Reload assets from navigation sync to show all synced data immediately
        await reloadAssetsFromNavigation();
        
        // Refresh cached inspections for currently selected asset
        if (selected) {
          fetchedInspFor.current = null; // Clear cache
          setInspFetchVersion(v => v + 1); // Trigger refresh
        }
      }
      
      // Update counts
      const offlineData = await getNavigationDataForMap();
      setOfflineAssetsCount(offlineData.assets.length);
      setOfflineInspectionsCount(offlineData.inspections.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Navigation sync failed';
      setNavigationSyncError(message);
      console.error('Manual navigation sync error:', error);
    } finally {
      setNavigationSyncLoading(false);
    }
  };

  // Swipe handling for inspection navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentInspectionIndex < (insp?.length || 1) - 1) {
      setCurrentInspectionIndex(prev => prev + 1);
    } else if (isRightSwipe && currentInspectionIndex > 0) {
      setCurrentInspectionIndex(prev => prev - 1);
    }
  };

  const nextInspection = () => {
    if (insp && currentInspectionIndex < insp.length - 1) {
      setCurrentInspectionIndex(prev => prev + 1);
    }
  };

  const prevInspection = () => {
    if (currentInspectionIndex > 0) {
      setCurrentInspectionIndex(prev => prev - 1);
    }
  };

  const openInspectionViewer = (index: number) => {
    setCurrentInspectionIndex(index);
    setShowInspectionViewer(true);
  };

  const closeInspectionViewer = () => {
    setShowInspectionViewer(false);
    setCurrentInspectionIndex(0);
  };

  // Reload assets from local navigation data
  const reloadAssetsFromNavigation = async () => {
    try {
      const hasLocalData = await hasNavigationData();
      
      if (hasLocalData) {
        const localNavData = await getNavigationDataForMap();
        
        if (localNavData.assets.length > 0) {
          // Convert navigation assets to map assets format
          const mapAssets: Asset[] = localNavData.assets.map(navAsset => ({
            Asset_Number: navAsset.Asset_Number,
            Location_Code: navAsset.Location_Code || "",
            NavAid_Name: navAsset.NavAid_Name || "",
            NavAid_Primary_Function: navAsset.NavAid_Primary_Function || "",
            STATUS: navAsset.STATUS || undefined,
            Latitude: navAsset.Latitude || 0,
            Longitude: navAsset.Longitude || 0,
            NavAid_Colour: navAsset.NavAid_Colour || undefined,
            Northing: navAsset.Northing || undefined,
            Easting: navAsset.Easting || undefined,
            UTM_Zone: navAsset.UTM_Zone || undefined,
            Chart_Character: navAsset.Chart_Character || undefined,
            Flash_Sequence: navAsset.Flash_Sequence || undefined,
            Light_Range: navAsset.Light_Range || undefined,
            Light_Colour: navAsset.Light_Colour || undefined,
            Light_Model: navAsset.Light_Model || undefined,
            Lead_Bearing: navAsset.Lead_Bearing || undefined,
            Daymark: navAsset.Daymark || undefined,
            Mark_Structure: navAsset.Mark_Structure || undefined,
            Situation: navAsset.Situation || undefined,
            Risk_Category: navAsset.Risk_Category || undefined,
            Infrastructure_Subgroup_Code: navAsset.Infrastructure_Subgroup_Code || undefined,
            Function_Code: navAsset.Function_Code || undefined,
            Horizontal_Accuracy: navAsset.Horizontal_Accuracy || undefined,
            Responsible_Agency: navAsset.Responsible_Agency || undefined,
            OWNER: navAsset.OWNER || undefined,
            NavAid_Shape: navAsset.NavAid_Shape || undefined,
            AIS_Type: navAsset.AIS_Type || undefined,
            MMSI_Number: navAsset.MMSI_Number || undefined,
          }));
          
          console.log(`Reloaded ${mapAssets.length} assets from navigation sync`);
          setAssets(mapAssets);
          assetsRef.current = mapAssets;
        }
      }
    } catch (error) {
      console.error('Error reloading assets from navigation:', error);
    }
  };

  const refreshInspections = () => {
    if (!selected) return;
    fetchedInspFor.current = null;
    setInsp(null);
    setInspError(null);
    setInspSource(null);
    setInspFetchVersion(v => v + 1);
  };

  const refreshEquipment = () => {
    if (!selected) return;
    fetchedEquipFor.current = null;
    setEquip(null);
    setEquipError(null);
    setEquipFetchVersion(v => v + 1);
  };
  const [searchId, setSearchId] = useState<string>("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const LABEL_MIN_ZOOM = 12; // labels appear from this zoom and above

  // Initial map center near provided sample coordinates
  const startCenter = useMemo(() => ({ longitude: 117.9635, latitude: -34.9604, zoom: 12 }), []);
  const [viewState, setViewState] = useState(startCenter);

  // Mapbox config
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  // Use a standard Mapbox Satellite base as the default
  const rawStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "mapbox://styles/mapbox/satellite-streets-v12";
  // If the provided style is an https URL with an embedded token, use it as a fallback token
  const tokenFromStyle = useMemo(() => {
    try {
      if (/^https?:\/\//i.test(rawStyle)) {
        const u = new URL(rawStyle);
        return u.searchParams.get("access_token") || "";
      }
    } catch {}
    return "";
  }, [rawStyle]);
  const effectiveToken = mapboxToken || tokenFromStyle;
  const mapStyle = useMemo(() => {
    // If the style is a full https URL with an embedded token, only strip it when we have an env token.
    try {
      if (/^https?:\/\//i.test(rawStyle)) {
        const u = new URL(rawStyle);
        if (mapboxToken) {
          u.searchParams.delete("access_token");
        }
        return u.toString();
      }
    } catch {}
    return rawStyle;
  }, [rawStyle, mapboxToken]);

  // Show a small hint when a Mapbox token isn't available via env or style URL param
  const needsToken = typeof rawStyle === "string" && (rawStyle.startsWith("mapbox://") || /api\.mapbox\.com/i.test(rawStyle));
  const hasTokenInStyle = typeof rawStyle === "string" && /[?&]access_token=/.test(rawStyle);
  const showTokenWarning = needsToken && !effectiveToken && !hasTokenInStyle;

  // Build circle polygon around lon/lat with given radius in meters
  const circlePolygon = (lon: number, lat: number, radiusM: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> => {
    const coords: [number, number][] = [];
    const degLat = radiusM / 111320; // ~ meters per degree latitude
    const degLonFactor = Math.cos((lat * Math.PI) / 180);
    const degLon = degLat / Math.max(0.000001, degLonFactor);
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      const dx = Math.cos(theta) * degLon;
      const dy = Math.sin(theta) * degLat;
      coords.push([lon + dx, lat + dy]);
    }
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {},
    };
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    const loadAssets = async () => {
      try {
        // First try to load from local navigation sync
        const hasLocalData = await hasNavigationData();
        
        if (hasLocalData) {
          // Load from locally synced navigation data
          console.log('Loading assets from local navigation sync...');
          const localNavData = await getNavigationDataForMap();
          
          if (localNavData.assets.length > 0) {
            // Convert navigation assets to map assets format
            const mapAssets: Asset[] = localNavData.assets.map(navAsset => ({
              Asset_Number: navAsset.Asset_Number,
              Location_Code: navAsset.Location_Code || "",
              NavAid_Name: navAsset.NavAid_Name || "",
              NavAid_Primary_Function: navAsset.NavAid_Primary_Function || "",
              STATUS: navAsset.STATUS || undefined,
              Latitude: navAsset.Latitude || 0,
              Longitude: navAsset.Longitude || 0,
              NavAid_Colour: navAsset.NavAid_Colour || undefined,
              Northing: navAsset.Northing || undefined,
              Easting: navAsset.Easting || undefined,
              UTM_Zone: navAsset.UTM_Zone || undefined,
              Chart_Character: navAsset.Chart_Character || undefined,
              Flash_Sequence: navAsset.Flash_Sequence || undefined,
              Light_Range: navAsset.Light_Range || undefined,
              Light_Colour: navAsset.Light_Colour || undefined,
              Light_Model: navAsset.Light_Model || undefined,
              Lead_Bearing: navAsset.Lead_Bearing || undefined,
              Daymark: navAsset.Daymark || undefined,
              Mark_Structure: navAsset.Mark_Structure || undefined,
              Situation: navAsset.Situation || undefined,
              Risk_Category: navAsset.Risk_Category || undefined,
              Infrastructure_Subgroup_Code: navAsset.Infrastructure_Subgroup_Code || undefined,
              Function_Code: navAsset.Function_Code || undefined,
              Horizontal_Accuracy: navAsset.Horizontal_Accuracy || undefined,
              Responsible_Agency: navAsset.Responsible_Agency || undefined,
              OWNER: navAsset.OWNER || undefined,
              NavAid_Shape: navAsset.NavAid_Shape || undefined,
              AIS_Type: navAsset.AIS_Type || undefined,
              MMSI_Number: navAsset.MMSI_Number || undefined,
            }));
            
            if (!cancelled) {
              console.log(`Loaded ${mapAssets.length} assets from local navigation sync`);
              setAssets(mapAssets);
              assetsRef.current = mapAssets;
              setLoading(false);
              return;
            }
          }
        }
        
        // Fallback to API if no local data
        console.log('Loading assets from API...');
        const controller = new AbortController();
        const res = await fetch("/api/assets", { signal: controller.signal });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        const data = body.data as Asset[];
        
        if (!cancelled) {
          console.log(`Loaded ${data.length} assets from API`);
          setAssets(data ?? []);
          assetsRef.current = data ?? [];
        }
        
      } catch (error) {
        if (!cancelled) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error loading assets:', errorMessage);
          setError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    loadAssets();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset tab data on selection change; keep Asset tab as default. Auto-load cached data.
  useEffect(() => {
    if (!selected) {
      setInsp(null);
      setInspSource(null);
      setEquip(null);
      setInspLoading(false);
      setEquipLoading(false);
      setInspError(null);
      setEquipError(null);
      fetchedInspFor.current = null;
      fetchedEquipFor.current = null;
      return;
    }
    setTab("asset");
    setInsp(null);
    setInspSource(null);
    setEquip(null);
    setInspLoading(false);
    setEquipLoading(false);
    setInspError(null);
    setEquipError(null);
    fetchedInspFor.current = null;
    fetchedEquipFor.current = null;

    // Auto-load cached inspection data when asset is selected
    const loadCachedInspections = async () => {
      try {
        const { getLocalNavigationInspections } = await import('@/lib/client-db/sqlite');
        const cachedInspections = await getLocalNavigationInspections(selected.Asset_Number);
        
        if (cachedInspections && cachedInspections.length > 0) {
          // Sort by inspection date (most recent first) and take only last 3
          const sortedInspections = cachedInspections
            .sort((a, b) => {
              const dateA = new Date(a.inspection_date || '').getTime();
              const dateB = new Date(b.inspection_date || '').getTime();
              return dateB - dateA; // Most recent first
            })
            .slice(0, 3); // Only last 3 inspections

          // Convert navigation inspections to InspectionRecord format
          const convertedInspections = sortedInspections.map((navInsp: any) => ({
            "Date/Time": navInsp.inspection_date || '',
            "Attendance Type": navInsp.attendance_type || '',
            "Condition Rating": navInsp.condition_rating || '',
            "Inspection Notes": navInsp.inspection_notes || '',
            "Recommendations": navInsp.recommendations || '',
            "Asset Status": navInsp.asset_status || '',
            "Water Depth": navInsp.water_depth || '',
            "Used Equipment?": navInsp.used_equipment ? 'Yes' : 'No',
            "Main Asset Photo": navInsp.main_asset_photo || '',
            "Additional #1": navInsp.additional_1 || '',
            "Additional #2": navInsp.additional_2 || '',
            "Additional #3": navInsp.additional_3 || '',
            "Additional #4": navInsp.additional_4 || '',
            "Additional #5": navInsp.additional_5 || '',
            "Additional #6": navInsp.additional_6 || '',
            "Situation": navInsp.situation || '',
            "Location Code": navInsp.location_code || '',
            "Location": navInsp.location || '',
            "Created": navInsp.created_raw || '',
            "Modified": navInsp.modified_raw || ''
          }));
          
          setInsp(convertedInspections);
          setInspSource('db');
          fetchedInspFor.current = selected.Asset_Number;
          
          console.log(`Loaded ${convertedInspections.length} most recent inspections for asset ${selected.Asset_Number} (from ${cachedInspections.length} total)`);
        }
      } catch (error) {
        console.warn('Failed to load cached inspections:', error);
      }
    };

    loadCachedInspections();
  }, [selected]); // Use full selected object since we check if it exists
  // Manual fetch handlers for inspections & equipment (use main sync for refresh)
  useEffect(() => {
    if (!selected || tab !== 'inspect') return; // only active tab
    if (fetchedInspFor.current === selected.Asset_Number && insp !== null) return; // already have
    if (inspFetchVersion === 0) return; // user hasn't requested a fetch yet
    
    // For inspections, we now rely on cached data loaded automatically
    // The inspFetchVersion is only triggered by the main navigation sync
    const loadFromMainSync = async () => {
      try {
        const { getLocalNavigationInspections } = await import('@/lib/client-db/sqlite');
        const cachedInspections = await getLocalNavigationInspections(selected.Asset_Number);
        
        if (cachedInspections && cachedInspections.length > 0) {
          // Sort by inspection date (most recent first) and take only last 3
          const sortedInspections = cachedInspections
            .sort((a, b) => {
              const dateA = new Date(a.inspection_date || '').getTime();
              const dateB = new Date(b.inspection_date || '').getTime();
              return dateB - dateA; // Most recent first
            })
            .slice(0, 3); // Only last 3 inspections

          const convertedInspections = sortedInspections.map((navInsp: any) => ({
            "Date/Time": navInsp.inspection_date || '',
            "Attendance Type": navInsp.attendance_type || '',
            "Condition Rating": navInsp.condition_rating || '',
            "Inspection Notes": navInsp.inspection_notes || '',
            "Recommendations": navInsp.recommendations || '',
            "Asset Status": navInsp.asset_status || '',
            "Water Depth": navInsp.water_depth || '',
            "Used Equipment?": navInsp.used_equipment ? 'Yes' : 'No',
            "Main Asset Photo": navInsp.main_asset_photo || '',
            "Additional #1": navInsp.additional_1 || '',
            "Additional #2": navInsp.additional_2 || '',
            "Additional #3": navInsp.additional_3 || '',
            "Additional #4": navInsp.additional_4 || '',
            "Additional #5": navInsp.additional_5 || '',
            "Additional #6": navInsp.additional_6 || '',
            "Situation": navInsp.situation || '',
            "Location Code": navInsp.location_code || '',
            "Location": navInsp.location || '',
            "Created": navInsp.created_raw || '',
            "Modified": navInsp.modified_raw || ''
          }));
          
          setInsp(convertedInspections);
          setInspSource('db');
          fetchedInspFor.current = selected.Asset_Number;
        }
      } catch (error) {
        console.warn('Failed to refresh inspections from cache:', error);
      }
    };

    loadFromMainSync();
  }, [inspFetchVersion, tab, selected?.Asset_Number]);

  useEffect(() => {
    if (!selected || tab !== 'equipment') return;
    if (fetchedEquipFor.current === selected.Asset_Number && equip !== null) return;
    if (equipFetchVersion === 0) return;
    let isCancelled = false;
    const ctrl = new AbortController();
    setEquipLoading(true);
    setEquipError(null);
    fetchedEquipFor.current = selected.Asset_Number;
    try { // load cache first
      const cached = (window as any)?.navCache?.getEquipment?.(selected.Asset_Number);
      if (cached && Array.isArray(cached)) {
        setEquip(cached as EquipmentRecord[]);
      }
    } catch {}
    fetch(`/api/navapp/equipment/${selected.Asset_Number}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
  .then(j => { if (isCancelled) return; setEquip(j?.data ?? []); try { (window as any)?.navCache?.setEquipment?.(selected.Asset_Number, j?.data ?? []);} catch {} })
      .catch(e => { if (isCancelled) return; if (!ctrl.signal.aborted) { setEquipError(e?.message || String(e)); setEquip([]); } })
      .finally(() => { if (!isCancelled) setEquipLoading(false); });
    return () => { isCancelled = true; ctrl.abort(); };
  }, [equipFetchVersion, tab, selected?.Asset_Number]);

  // Update GeoJSON source when assets change and fit bounds
  const [assetsGeo, setAssetsGeo] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({ type: "FeatureCollection", features: [] });
  const [accuracyGeo, setAccuracyGeo] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });

  useEffect(() => {
    if (!assets || assets.length === 0) {
      setAssetsGeo({ type: "FeatureCollection", features: [] });
      setMapReady(true);
      return;
    }

    assetsRef.current = assets;
    setMapReady(false);
    
    try {
      const fc: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: "FeatureCollection",
        features: assets
          .filter(a => a.Longitude != null && a.Latitude != null && 
                      Number.isFinite(a.Longitude) && Number.isFinite(a.Latitude))
          .map((a) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [a.Longitude, a.Latitude] },
            properties: {
              Asset_Number: a.Asset_Number,
              NavAid_Name: a.NavAid_Name || "",
              NavAid_Primary_Function: a.NavAid_Primary_Function || "",
              STATUS: a.STATUS ?? "",
              Location_Code: a.Location_Code || "",
              NavAid_Colour: a.NavAid_Colour ?? "",
              Northing: a.Northing ?? "",
              Easting: a.Easting ?? "",
              UTM_Zone: a.UTM_Zone ?? "",
              Chart_Character: a.Chart_Character ?? "",
              Flash_Sequence: a.Flash_Sequence ?? "",
              Light_Range: a.Light_Range ?? "",
              Light_Colour: a.Light_Colour ?? "",
              Light_Model: a.Light_Model ?? "",
              Lead_Bearing: a.Lead_Bearing ?? "",
              Daymark: a.Daymark ?? "",
              Mark_Structure: a.Mark_Structure ?? "",
              Situation: a.Situation ?? "",
              Risk_Category: a.Risk_Category ?? "",
              Infrastructure_Subgroup_Code: a.Infrastructure_Subgroup_Code ?? "",
              Function_Code: a.Function_Code ?? "",
              Horizontal_Accuracy: a.Horizontal_Accuracy ?? "",
              Responsible_Agency: a.Responsible_Agency ?? "",
              OWNER: a.OWNER ?? "",
              NavAid_Shape: a.NavAid_Shape ?? "",
              AIS_Type: a.AIS_Type ?? "",
              MMSI_Number: a.MMSI_Number ?? "",
            },
          }))
      };
      
      setAssetsGeo(fc);

      // Fit to bounds of assets with safety checks
      if (fc.features.length > 0 && mapRef.current) {
        const map = mapRef.current;
        
        // Wait for map to be ready before fitting bounds
        const fitBounds = () => {
          try {
            if (!map.getMap?.() || !map.getMap().loaded()) {
              setTimeout(fitBounds, 100);
              return;
            }
            
            const validFeatures = fc.features.filter(f => 
              f.geometry.coordinates.length === 2 &&
              Number.isFinite(f.geometry.coordinates[0]) &&
              Number.isFinite(f.geometry.coordinates[1])
            );
            
            if (validFeatures.length === 0) {
              setMapReady(true);
              return;
            }
            
            const bounds = validFeatures.reduce(
              (b, feature) => {
                const [lng, lat] = feature.geometry.coordinates;
                b[0][0] = Math.min(b[0][0], lng);
                b[0][1] = Math.min(b[0][1], lat);
                b[1][0] = Math.max(b[1][0], lng);
                b[1][1] = Math.max(b[1][1], lat);
                return b;
              },
              [
                [Infinity, Infinity],
                [-Infinity, -Infinity],
              ] as [number, number][]
            );
            
            if (Number.isFinite(bounds[0][0]) && Number.isFinite(bounds[1][0])) {
              const tuple: [[number, number], [number, number]] = [
                [bounds[0][0], bounds[0][1]],
                [bounds[1][0], bounds[1][1]],
              ];
              
              map.fitBounds(tuple, { 
                padding: 40, 
                maxZoom: 14, 
                duration: 800,
                essential: true 
              });
              
              setTimeout(() => setMapReady(true), 850);
            } else {
              setMapReady(true);
            }
          } catch (error) {
            console.warn('Error fitting bounds:', error);
            setMapReady(true);
          }
        };
        
        fitBounds();
      } else {
        setMapReady(true);
      }
    } catch (error) {
      console.error('Error processing assets for map:', error);
      setAssetsGeo({ type: "FeatureCollection", features: [] });
      setMapReady(true);
    }
  }, [assets]);

  // Apply color mode to the circle layer and keep it in sync with style changes
  const circlePaint = useMemo<Record<string, unknown>>(() => {
    if (colorMode === "amber") {
      return {
        "circle-color": "#facc15",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-radius": 6,
      };
    }
    return {
      "circle-color": [
        "case",
        [
          "any",
          ["in", "Isolated Danger", ["get", "NavAid_Primary_Function"]],
          ["in", "Isolated Danger", ["downcase", ["get", "NavAid_Name"]]]
        ], "#ef4444",
        [
          "any",
          ["in", "Cardinal", ["get", "NavAid_Primary_Function"]],
          ["in", "cardinal", ["downcase", ["get", "NavAid_Name"]]]
        ], "#facc15",
        ["match", ["downcase", ["get", "Light_Colour"]], ["red"], true, false], "#ef4444",
        ["match", ["downcase", ["get", "Light_Colour"]], ["green"], true, false], "#16a34a",
        ["match", ["downcase", ["get", "Light_Colour"]], ["yellow"], true, false], "#facc15",
        ["match", ["downcase", ["get", "Light_Colour"]], ["white"], true, false], "#ffffff",
        ["match", ["downcase", ["get", "Daymark"]], ["red"], true, false], "#ef4444",
        ["match", ["downcase", ["get", "Daymark"]], ["green"], true, false], "#16a34a",
        ["match", ["downcase", ["get", "Daymark"]], ["yellow"], true, false], "#facc15",
        ["match", ["downcase", ["get", "Daymark"]], ["white"], true, false], "#ffffff",
        ["match", ["downcase", ["get", "NavAid_Colour"]], ["red"], true, false], "#ef4444",
        ["match", ["downcase", ["get", "NavAid_Colour"]], ["green"], true, false], "#16a34a",
        ["match", ["downcase", ["get", "NavAid_Colour"]], ["yellow"], true, false], "#facc15",
        ["match", ["downcase", ["get", "NavAid_Colour"]], ["white"], true, false], "#ffffff",
        ["match", ["downcase", ["get", "NavAid_Colour"]], ["black/yellow", "yellow/black"], true, false], "#facc15",
        "#2563eb"
      ],
      "circle-stroke-color": [
        "case",
        [
          "any",
          ["in", "Isolated Danger", ["get", "NavAid_Primary_Function"]],
          ["in", "Isolated Danger", ["downcase", ["get", "NavAid_Name"]]]
        ], "#000000",
        [
          "any",
          ["in", "Cardinal", ["get", "NavAid_Primary_Function"]],
          ["in", "cardinal", ["downcase", ["get", "NavAid_Name"]]]
        ], "#000000",
        ["match", ["downcase", ["get", "NavAid_Colour"]], ["black/yellow", "yellow/black"], true, false], "#000000",
        "#ffffff"
      ],
      "circle-stroke-width": 2,
  "circle-radius": 6,
  };
  }, [colorMode]);

  // Handle user interaction detection for following mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isFollowingUser) return;

    const stopFollowing = () => {
      console.log("User interaction detected - stopping location follow");
      setIsFollowingUser(false);
    };

    map.on("dragstart", stopFollowing);
    map.on("zoomstart", stopFollowing);
    map.on("rotatestart", stopFollowing);

    return () => {
      map.off("dragstart", stopFollowing);
      map.off("zoomstart", stopFollowing);
      map.off("rotatestart", stopFollowing);
    };
  }, [isFollowingUser]);

  // Always attempt precise tracking on page load (no auto-centering)
  useEffect(() => {
    const map = mapRef.current;
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported by this browser");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        userPosRef.current = { lon: longitude, lat: latitude };
        // Update accuracy source
        const feature = ((): GeoJSON.Feature | null => {
          if (!Number.isFinite(accuracy) || accuracy == null) return null;
          const clamped = Math.min(accuracy, 1000);
          return circlePolygon(longitude, latitude, clamped);
        })();
        setAccuracyGeo({ type: "FeatureCollection", features: feature ? [feature] : [] });

        setAccuracy(Number.isFinite(accuracy) ? Math.round(accuracy) : null);

        // If in following mode, center the map on user location
        if (isFollowingUser) {
          const currentZoom = map?.getZoom ? map.getZoom() : 0;
          const targetZoom = Math.min(15, Math.max(12, Number.isFinite(currentZoom) ? currentZoom : 12));
          map?.easeTo({ center: [longitude, latitude], zoom: targetZoom, duration: 300 });
        }
      },
      (err) => {
        console.warn("Geolocation error", err);
        const msg = err?.message || String(err);
        if (/permission/i.test(msg) || /denied/i.test(msg)) {
          setError("Location permission denied. Please allow access in your browser settings.");
        } else if (/policy/i.test(msg)) {
          setError("Location blocked by browser policy. Reload after allowing location for this site.");
        } else {
          setError("Unable to get location. Move outdoors or try again.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [isFollowingUser]); // Add dependency so it responds to following mode changes

  // One-shot recenter helper bound to the button
  const recenterToUser = () => {
    const m = mapRef.current;
    if (!m) return;
    
    // Enable following mode
    setIsFollowingUser(true);
    console.log("Following mode enabled - map will track user location");
    
    const pos = userPosRef.current;
    if (pos) {
      const currentZoom = m.getZoom ? m.getZoom() : 0;
      // Reduce max zoom to prevent tile loading errors - level 15 is plenty for user location
      const targetZoom = Math.min(15, Math.max(12, Number.isFinite(currentZoom) ? currentZoom : 12));
      m.easeTo({ center: [pos.lon, pos.lat], zoom: targetZoom, duration: 600 });
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const { latitude, longitude } = p.coords;
          userPosRef.current = { lon: longitude, lat: latitude };
          const currentZoom = m.getZoom ? m.getZoom() : 0;
          // Reduce max zoom to prevent tile loading errors - level 15 is plenty for user location
          const targetZoom = Math.min(15, Math.max(12, Number.isFinite(currentZoom) ? currentZoom : 0));
          m.easeTo({ center: [longitude, latitude], zoom: targetZoom, duration: 600 });
        },
        (err) => {
          const msg = err?.message || String(err);
          setError(/denied/i.test(msg) ? "Location permission denied." : "Unable to get location.");
          setIsFollowingUser(false); // Disable following if location fails
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  };

  // Keyboard: allow closing modal with Escape
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Click handler for asset points
  const onMapClick = useCallback((e: unknown) => {
    try {
      const features = (e as MapClickEvent)?.features as Array<{ properties?: Record<string, unknown>; geometry?: GeoJSON.Geometry }> | undefined;
      const f = features && features[0];
      if (!f || !f.properties || !f.geometry) return;
      
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      
      if (!coords || coords.length !== 2) return;
      
      const getStr = (key: string): string | undefined => {
        const v = p[key];
        return v == null || v === "" ? undefined : String(v);
      };
      const getNum = (key: string): number | undefined => {
        const v = p[key];
        if (v == null || v === "") return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      
      const idNum = getNum("Asset_Number");
      if (idNum == null || Number.isNaN(idNum)) return;
      
      const full = assetsRef.current.find((a) => a.Asset_Number === idNum);
      if (full) {
        setSelected(full);
        setTab("asset");
      } else {
        // Create asset from map properties
        setSelected({
          Asset_Number: idNum,
          NavAid_Name: getStr("NavAid_Name") ?? "",
          NavAid_Primary_Function: getStr("NavAid_Primary_Function") ?? "",
          STATUS: getStr("STATUS"),
          Location_Code: getStr("Location_Code") ?? "",
          Latitude: coords[1],
          Longitude: coords[0],
          NavAid_Colour: getStr("NavAid_Colour"),
          Northing: getNum("Northing"),
          Easting: getNum("Easting"),
          UTM_Zone: getNum("UTM_Zone"),
          Chart_Character: getStr("Chart_Character"),
          Flash_Sequence: getStr("Flash_Sequence"),
          Light_Range: getStr("Light_Range"),
          Light_Colour: getStr("Light_Colour"),
          Light_Model: getStr("Light_Model"),
          Lead_Bearing: getStr("Lead_Bearing"),
          Daymark: getStr("Daymark"),
          Mark_Structure: getStr("Mark_Structure"),
          Situation: getStr("Situation"),
          Risk_Category: getNum("Risk_Category"),
          Infrastructure_Subgroup_Code: getStr("Infrastructure_Subgroup_Code"),
          Function_Code: getStr("Function_Code"),
          Horizontal_Accuracy: getStr("Horizontal_Accuracy"),
          Responsible_Agency: getStr("Responsible_Agency"),
          OWNER: getStr("OWNER"),
          NavAid_Shape: getStr("NavAid_Shape"),
          AIS_Type: getStr("AIS_Type"),
          MMSI_Number: getStr("MMSI_Number"),
        });
        setTab("asset");
      }
    } catch (error) {
      console.warn('Error handling map click:', error);
    }
  }, []);

  const [showImageFull, setShowImageFull] = useState(false);

  return (
    <>
      {/* Full-Screen Inspection Modal */}
      {showInspectionViewer && insp && insp[currentInspectionIndex] && (
        <div 
          className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-2"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Inspection Details
                </h2>
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                  {currentInspectionIndex + 1} of {insp.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Navigation arrows */}
                <button
                  onClick={prevInspection}
                  disabled={currentInspectionIndex === 0}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextInspection}
                  disabled={currentInspectionIndex === insp.length - 1}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={closeInspectionViewer}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const inspection = insp[currentInspectionIndex];
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Basic Info */}
                    <div className="space-y-6">
                      <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Date</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatDateToDDMMYYYY(inspection["Date/Time"]) || "Unknown"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Asset ID</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {(() => {
                                // Try to get Asset ID from Key field first
                                if (inspection.Key && inspection.Key !== "Unknown") {
                                  return inspection.Key;
                                }
                                
                                // Fallback: extract number from Location field (e.g., PS-2980 → 2980)
                                if (inspection.Location) {
                                  const match = inspection.Location.match(/-(\d+)$/);
                                  if (match) {
                                    return match[1];
                                  }
                                }
                                
                                // Last fallback: use selected asset number if available
                                return selected?.Asset_Number?.toString() || "Unknown";
                              })()}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Condition Rating</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {inspection["Condition Rating"] || "Not specified"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Status</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {inspection["Asset Status"] || "Unknown"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Attendance Type</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {inspection["Attendance Type"] || "Not specified"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Situation</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {inspection.Situation || "Not specified"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Water Depth</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {inspection["Water Depth"] ? `${inspection["Water Depth"]}m` : "Not specified"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-neutral-400">Location</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {inspection["Location Code"] || inspection.Location || "Not specified"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Equipment Details */}
                      {inspection["Equipment Used"] && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Equipment Used</h3>
                          <p className="text-sm text-gray-700 dark:text-neutral-300">
                            {inspection["Equipment Used"]}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Column - Notes & Photos */}
                    <div className="space-y-6">
                      {/* Inspection Notes */}
                      {inspection["Inspection Notes"] && (
                        <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Inspection Notes</h3>
                          <p className="text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap">
                            {inspection["Inspection Notes"]}
                          </p>
                        </div>
                      )}

                      {/* Recommendations */}
                      {inspection.Recommendations && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">Recommendations</h3>
                          <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                            {inspection.Recommendations}
                          </p>
                        </div>
                      )}

                      {/* Main Photo */}
                      {inspection["Main Asset Photo"] && (
                        <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Main Asset Photo</h3>
                          <div className="aspect-video bg-gray-200 dark:bg-neutral-700 rounded-lg overflow-hidden">
                            <img
                              src={`/api/inspection-images?path=${encodeURIComponent(inspection["Main Asset Photo"] || '')}`}
                              alt="Main Asset Photo"
                              className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => openImageLightbox(inspection["Main Asset Photo"]!)}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-500">
                                      <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      <p class="text-xs text-center">Image not available</p>
                                      <p class="text-xs text-center mt-1">${inspection["Main Asset Photo"]}</p>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Additional Photos */}
                      {(inspection["Additional #1"] || inspection["Additional #2"] || inspection["Additional #3"] || 
                        inspection["Additional #4"] || inspection["Additional #5"] || inspection["Additional #6"]) && (
                        <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Additional Photos</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {[1,2,3,4,5,6].map(i => {
                              const photo = inspection[`Additional #${i}` as keyof typeof inspection];
                              if (!photo) return null;
                              return (
                                <div key={i} className="aspect-square bg-gray-200 dark:bg-neutral-700 rounded-lg overflow-hidden">
                                  <img
                                    src={`/api/inspection-images?path=${encodeURIComponent(photo as string)}`}
                                    alt={`Additional Photo ${i}`}
                                    className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => openImageLightbox(photo as string)}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = `
                                          <div class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-500">
                                            <svg class="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p class="text-xs text-center">Photo ${i}</p>
                                            <p class="text-xs text-center">Not available</p>
                                          </div>
                                        `;
                                      }
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-[calc(100vh-64px)] w-full grid grid-rows-[auto_1fr] gap-2">
  <div className="flex items-center justify-between gap-2 py-2 px-2 sm:px-4">
        <div className="flex items-center gap-2">
          <h1 className="hidden sm:block text-lg font-semibold pr-3">Assets Map</h1>
          {/* Mobile search (left-aligned) */}
          <div className="flex sm:hidden items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Asset #"
              className="w-28 sm:w-36 px-2 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-100 dark:placeholder-neutral-500"
              value={searchId}
              onChange={(e) => {
                // keep only digits
                const digits = e.target.value.replace(/[^0-9]/g, "");
                setSearchId(digits);
                if (searchError) setSearchError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const id = Number(searchId);
                  if (!searchId || !Number.isFinite(id)) {
                    setSearchError("Enter a valid Asset #");
                    return;
                  }
                  const asset = assetsRef.current.find((a) => a.Asset_Number === id);
                  if (!asset) {
                    setSearchError("Asset not found");
                    return;
                  }
                  const map = mapRef.current;
                  if (map) {
                    const currentZoom = map.getZoom ? map.getZoom() : 0;
                    const targetZoom = Math.max(16, Number.isFinite(currentZoom) ? currentZoom : 0);
                    map.easeTo({ center: [asset.Longitude, asset.Latitude], zoom: targetZoom, duration: 600 });
                  }
                }
              }}
              aria-label="Search by Asset Number"
            />
            <button
              onClick={() => {
                const id = Number(searchId);
                if (!searchId || !Number.isFinite(id)) {
                  setSearchError("Enter a valid Asset #");
                  return;
                }
                const asset = assetsRef.current.find((a) => a.Asset_Number === id);
                if (!asset) {
                  setSearchError("Asset not found");
                  return;
                }
                setSearchError(null);
                const map = mapRef.current;
                if (map) {
                  const currentZoom = map.getZoom ? map.getZoom() : 0;
                  const targetZoom = Math.max(16, Number.isFinite(currentZoom) ? currentZoom : 0);
                  map.easeTo({ center: [asset.Longitude, asset.Latitude], zoom: targetZoom, duration: 600 });
                }
              }}
              className="px-3 py-1.5 rounded border text-sm bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-700"
            >
              Go
            </button>
          </div>
  </div>
    {/* Right group: controls + desktop search */}
  <div className="flex items-center gap-3 pr-4 sm:pr-6">
          {/* Desktop search (hidden on mobile), centered-ish by flex distribution */}
          <div className="hidden sm:flex items-center gap-2 mx-auto">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Asset #"
              className="w-28 sm:w-36 px-2 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-100 dark:placeholder-neutral-500"
              value={searchId}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                setSearchId(digits);
                if (searchError) setSearchError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const id = Number(searchId);
                  if (!searchId || !Number.isFinite(id)) {
                    setSearchError("Enter a valid Asset #");
                    return;
                  }
                  const asset = assetsRef.current.find((a) => a.Asset_Number === id);
                  if (!asset) {
                    setSearchError("Asset not found");
                    return;
                  }
                  const map = mapRef.current;
                  if (map) {
                    const currentZoom = map.getZoom ? map.getZoom() : 0;
                    const targetZoom = Math.max(16, Number.isFinite(currentZoom) ? currentZoom : 0);
                    map.easeTo({ center: [asset.Longitude, asset.Latitude], zoom: targetZoom, duration: 600 });
                  }
                }
              }}
              aria-label="Search by Asset Number"
            />
            <button
              onClick={() => {
                const id = Number(searchId);
                if (!searchId || !Number.isFinite(id)) {
                  setSearchError("Enter a valid Asset #");
                  return;
                }
                const asset = assetsRef.current.find((a) => a.Asset_Number === id);
                if (!asset) {
                  setSearchError("Asset not found");
                  return;
                }
                setSearchError(null);
                const map = mapRef.current;
                if (map) {
                  const currentZoom = map.getZoom ? map.getZoom() : 0;
                  const targetZoom = Math.max(16, Number.isFinite(currentZoom) ? currentZoom : 0);
                  map.easeTo({ center: [asset.Longitude, asset.Latitude], zoom: targetZoom, duration: 600 });
                }
              }}
              className="px-3 py-1.5 rounded border text-sm bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-700"
            >
              Go
            </button>
          </div>
          {/* Locate button: icon on mobile, text on desktop */}
          <button
            onClick={recenterToUser}
            className={`px-2 sm:px-3 py-1.5 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 flex items-center justify-center transition-colors ${
              isFollowingUser 
                ? "bg-blue-500 border-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:border-blue-600 dark:hover:bg-blue-700" 
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-700"
            }`}
            title={isFollowingUser ? "Following your location (pan to stop)" : "Center on my location"}
            aria-label={isFollowingUser ? "Following location" : "Locate me"}
          >
            <span className="sm:hidden inline-block" aria-hidden>
              {/* Crosshair icon with animation when following */}
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={isFollowingUser ? "animate-pulse" : ""}
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 2v3M12 19v3M22 12h-3M5 12H2"></path>
                <path d="M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12"></path>
              </svg>
            </span>
            <span className="hidden sm:inline">
              {isFollowingUser ? "Following" : "Locate me"}
            </span>
          </button>
          {/* Colors toggle: icon on mobile, label on desktop */}
          <button
            onClick={() => setColorMode((m) => (m === "auto" ? "amber" : "auto"))}
            className="px-2 sm:px-3 py-1.5 rounded border text-sm bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-700 flex items-center justify-center"
            title="Toggle asset colors"
            aria-label="Toggle asset colors"
          >
            <span className="sm:hidden inline-block" aria-hidden>
              {/* Palette icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c5.523 0 10-4.03 10-9s-4.477-9-10-9S2 8.03 2 13c0 2.761 2.239 5 5 5h1a2 2 0 0 0 2-2c0-1.105-.895-2-2-2H8"></path>
                <circle cx="7.5" cy="10.5" r="1.5"></circle>
                <circle cx="12" cy="8.5" r="1.5"></circle>
                <circle cx="16.5" cy="10.5" r="1.5"></circle>
              </svg>
            </span>
            <span className="hidden sm:inline">Colours: {colorMode === "auto" ? "Auto" : "Amber"}</span>
          </button>
          <span className="text-sm px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200">
            {accuracy != null ? `±${accuracy} m` : "--"}
          </span>
          
          {/* Navigation sync status */}
          <div className="flex items-center gap-2">
            {navigationSyncLoading ? (
              <span className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <svg className="animate-spin w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Syncing...
              </span>
            ) : (
              <button
                onClick={triggerNavigationSync}
                className="flex items-center gap-2 text-xs px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 transition-colors"
                title={`${offlineAssetsCount} navigation assets and ${offlineInspectionsCount} inspections cached offline. Click to sync.`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">
                  Nav: {offlineAssetsCount}A/{offlineInspectionsCount}I
                </span>
                <span className="sm:hidden">
                  {offlineAssetsCount + offlineInspectionsCount}
                </span>
              </button>
            )}
          </div>
          
          {loading && <span className="text-muted-foreground text-sm">Loading…</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
          {searchError && <span className="text-red-600 text-sm">{searchError}</span>}
          {navigationSyncError && <span className="text-orange-600 text-xs">Sync: {navigationSyncError}</span>}
        </div>
      </div>
      {showTokenWarning && (
        <div className="mx-2 sm:mx-4 -mt-2 mb-1 rounded border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-3 py-2 text-xs">
          Mapbox token is missing. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or NEXT_PUBLIC_MAPBOX_TOKEN) in your environment, or include access_token in your style URL.
        </div>
      )}
  <div className="relative w-full h-full min-h-[400px] rounded overflow-hidden border">
    {effectiveToken ? (
      <ReactMap
        ref={mapRef}
        mapboxAccessToken={effectiveToken}
        mapStyle={mapStyle}
        initialViewState={startCenter}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={() => {
          console.log('Map loaded successfully');
          setMapReady(true);
          // Only set up cursor interactions after map is fully loaded
          setTimeout(() => {
            try {
              const map = mapRef.current?.getMap?.();
              if (map && map.loaded()) {
                map.on('mouseenter', 'assets-circles', () => { 
                  map.getCanvas().style.cursor = 'pointer'; 
                });
                map.on('mouseleave', 'assets-circles', () => { 
                  map.getCanvas().style.cursor = ''; 
                });
              }
            } catch (error) {
              console.warn('Failed to set up map cursor interactions:', error);
            }
          }, 100);
        }}
        onError={(e: unknown) => {
          let msg = "Map load error";
          if (typeof e === "object" && e !== null) {
            const err = e as { error?: { message?: unknown }; type?: unknown };
            msg = typeof err?.error?.message === "string" ? err.error.message :
                  typeof err?.type === "string" ? err.type : msg;
          }
          console.error('Map error:', msg);
          setError(msg);
        }}
        {...viewState}
        interactiveLayerIds={["assets-circles"]}
        onClick={onMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-left" showCompass={true} />
        
        {/* Assets */}
        {assetsGeo.features.length > 0 && (
          <Source id="assets-src" type="geojson" data={assetsGeo}>
            <Layer
              id="assets-circles"
              type="circle"
              paint={circlePaint}
            />
            <Layer
              id="assets-labels"
              type="symbol"
              layout={{
                "text-field": ["to-string", ["get", "Asset_Number"]],
                "text-size": 12,
                "text-offset": [0, 1.1],
                "text-anchor": "top",
                "text-allow-overlap": false,
              }}
              paint={{
                "text-color": "#111827",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.2,
              }}
              minzoom={LABEL_MIN_ZOOM}
            />
          </Source>
        )}

        {/* Accuracy circle */}
        {accuracyGeo.features.length > 0 && (
          <Source id="user-accuracy-src" type="geojson" data={accuracyGeo}>
            <Layer id="user-accuracy-fill" type="fill" paint={{ "fill-color": "#3b82f6", "fill-opacity": 0.15 }} />
            <Layer id="user-accuracy-line" type="line" paint={{ "line-color": "#3b82f6", "line-width": 2, "line-opacity": 0.7 }} />
          </Source>
        )}

        {/* User marker */}
        {userPosRef.current && (
          <RglMarker longitude={userPosRef.current.lon} latitude={userPosRef.current.lat} anchor="center">
            <div style={{ width: 16, height: 16, borderRadius: 9999, backgroundColor: "#ef4444", border: "2px solid white" }} />
          </RglMarker>
        )}
      </ReactMap>
    ) : (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-neutral-800">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">Map Unavailable</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {showTokenWarning ? "Mapbox token is missing" : "Map initialization failed"}
          </div>
        </div>
      </div>
    )}
    
    {/* Loading overlay */}
    {(loading || !mapReady) && (
      <div className="absolute inset-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm flex items-center justify-center z-20">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            {loading ? "Loading navigation assets..." : "Positioning map..."}
          </p>
        </div>
      </div>
    )}
    
    
  </div>

  {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4 lg:p-6"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white text-black dark:bg-neutral-900 dark:text-white w-full h-full sm:h-[95vh] lg:h-[98vh] sm:w-[95vw] lg:w-[98vw] rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="sm:hidden pt-3 pb-2 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-neutral-600" />
            </div>
            
            {/* Enhanced header */}
            <div className="sticky top-0 z-10 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                        Asset #{selected.Asset_Number}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-neutral-300 truncate font-medium">
                        {selected.Location_Code}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700 dark:text-neutral-300 truncate">
                      <span className="font-medium">{selected.NavAid_Name || "Asset"}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                        {selected.NavAid_Primary_Function}
                      </span>
                      {selected.Situation && (
                        <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                          {selected.Situation}
                        </span>
                      )}
                      {selected.STATUS && (
                        <span className="px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full font-medium">
                          {selected.STATUS}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  onClick={() => setSelected(null)}
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Enhanced tabs */}
            <div className="px-2 sm:px-6 py-3 border-b border-gray-100 dark:border-neutral-800/50">
              <div className="flex space-x-1 bg-gray-100 dark:bg-neutral-800/50 rounded-xl p-1 overflow-x-auto">
                <TabBtn active={tab === "asset"} onClick={() => {
                  console.log("Setting tab to: asset");
                  setTab("asset");
                }}>
                  <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="hidden xs:inline sm:inline">Asset Details</span>
                  <span className="xs:hidden sm:hidden">Asset</span>
                </TabBtn>
                <TabBtn active={tab === "inspect"} onClick={() => {
                  console.log("Setting tab to: inspect");
                  setTab("inspect");
                }}>
                  <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden xs:inline sm:inline">Inspections</span>
                  <span className="xs:hidden sm:hidden">Inspect</span>
                  {insp && insp.length > 0 && (
                    <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      {insp.length}
                    </span>
                  )}
                </TabBtn>
                <TabBtn active={tab === "equipment"} onClick={() => {
                  // Equipment functionality disabled - no data tables set up yet
                  console.log("Equipment tab disabled - no data tables available");
                }} disabled>
                  <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden xs:inline sm:inline">Equipment</span>
                  <span className="xs:hidden sm:hidden">Equip</span>
                  <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                    Soon
                  </span>
                </TabBtn>
              </div>
            </div>

            {/* Enhanced content area */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain">
              {/* Asset Tab */}
              <div className={tab === "asset" ? "block" : "hidden"}>
                <div className="p-4 sm:p-6 space-y-6">
                  {/* Asset photo from newest inspection */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M3 19h18M5 5l6.5 7L5 19m14-14l-6.5 7L19 19" />
                      </svg>
                      Asset Photo
                    </h3>
                    <div className="flex items-start gap-4">
                      {(() => {
                        return newestMainPhoto ? (
                          <button
                            type="button"
                            onClick={() => openImageLightbox(newestMainPhoto)}
                            className="group relative border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 w-40 h-28 flex items-center justify-center"
                            title="Click to view full size"
                          >
                            <img
                              src={`/api/inspection-images?path=${encodeURIComponent(newestMainPhoto)}`}
                              alt="Latest Asset Photo"
                              className="w-full h-full object-contain group-hover:opacity-90 transition-opacity"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "/asset-placeholder.svg";
                                target.className = "w-20 h-20 opacity-80 group-hover:opacity-100 transition-opacity";
                                target.alt = "Asset placeholder";
                              }}
                            />
                            <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">Latest</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowImageFull(true)}
                            className="group relative border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 w-40 h-28 flex items-center justify-center"
                            title="Click to enlarge"
                          >
                            <img
                              src="/asset-placeholder.svg"
                              alt="Asset placeholder"
                              className="w-20 h-20 opacity-80 group-hover:opacity-100 transition-opacity"
                              loading="lazy"
                            />
                            <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">Preview</span>
                          </button>
                        );
                      })()}
                      <p className="text-xs text-gray-500 dark:text-neutral-400 max-w-sm leading-relaxed">
                        {newestMainPhoto 
                          ? "Showing the most recent inspection photo. Click to view in full screen with all inspection images."
                          : "No inspection photos available. A placeholder image is shown. Click the thumbnail to view a larger preview."
                        }
                      </p>
                    </div>
                  </div>
                  {/* Asset Section - Identifying information and location data */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Asset Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      <Field label="Asset Number" value={selected.Asset_Number} />
                      <Field label="Location Code" value={selected.Location_Code} />
                      <Field label="Asset Name" value={selected.NavAid_Name || "—"} />
                      <Field label="Primary Function" value={selected.NavAid_Primary_Function} />
                      <Field label="Situation" value={selected.Situation || "—"} />
                      {selected.STATUS && <Field label="Status" value={selected.STATUS} />}
                      <Field label="Latitude" value={selected.Latitude.toFixed(6)} />
                      <Field label="Longitude" value={selected.Longitude.toFixed(6)} />
                      {selected.Northing != null && <Field label="Northing" value={String(selected.Northing)} />} 
                      {selected.Easting != null && <Field label="Easting" value={String(selected.Easting)} />} 
                      {selected.UTM_Zone != null && <Field label="UTM Zone" value={String(selected.UTM_Zone)} />}
                      {selected.Horizontal_Accuracy && (
                        <Field label="Horizontal Accuracy" value={selected.Horizontal_Accuracy} />
                      )}
                    </div>
                  </div>

                  {/* Characteristics Section - Light and navigation characteristics */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Navigation Characteristics
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {selected.Light_Colour && <Field label="Light Colour" value={selected.Light_Colour} />}
                      {selected.Light_Range && <Field label="Light Range" value={selected.Light_Range} />}
                      {selected.Flash_Sequence && <Field label="Flash Sequence" value={selected.Flash_Sequence} />}
                      {selected.Chart_Character && <Field label="Chart Character" value={selected.Chart_Character} />}
                      {selected.Lead_Bearing && <Field label="Lead Bearing" value={selected.Lead_Bearing} />}
                      {selected.NavAid_Colour && <Field label="NavAid Colour" value={selected.NavAid_Colour} />}
                      {selected.NavAid_Shape && <Field label="NavAid Shape" value={selected.NavAid_Shape} />}
                      {selected.Daymark && <Field label="Daymark" value={selected.Daymark} />}
                    </div>
                  </div>

                  {/* Other Section - Administrative and technical details */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Additional Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {selected.Risk_Category != null && (
                        <Field label="Risk Category" value={String(selected.Risk_Category)} />
                      )}
                      {selected.Mark_Structure && <Field label="Mark Structure" value={selected.Mark_Structure} />}
                      {selected.Infrastructure_Subgroup_Code && (
                        <Field label="Infrastructure Subgroup Code" value={selected.Infrastructure_Subgroup_Code} />
                      )}
                      {selected.Function_Code && <Field label="Function Code" value={selected.Function_Code} />}
                      {selected.Responsible_Agency && <Field label="Responsible Agency" value={selected.Responsible_Agency} />}
                      {selected.OWNER && <Field label="Owner" value={selected.OWNER} />}
                      {selected.AIS_Type && <Field label="AIS Type" value={selected.AIS_Type} />}
                      {selected.MMSI_Number && <Field label="MMSI Number" value={selected.MMSI_Number} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inspections Tab */}
              <div className={tab === "inspect" ? "block" : "hidden"}>
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Inspection History</h3>
                      <div className="text-xs text-gray-500 dark:text-neutral-400">
                        {inspLoading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Loading inspections…
                          </span>
                        ) : (
                          <span>
                            {insp ? `${insp.length} record${insp.length === 1 ? '' : 's'}` : 'No data cached'}
                            {inspSource && ` from ${inspSource}`}
                            {insp && insp.length > 0 && (
                              <span className="ml-2 text-green-600 dark:text-green-400">• Offline Ready</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-neutral-500">
                      Use main sync button to refresh data
                    </div>
                  </div>
                  
                  {inspError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{inspError}</p>
                    </div>
                  )}
                  
          {(!inspLoading && (!insp || insp.length === 0)) && (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-400 dark:text-neutral-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
            <p className="text-sm text-gray-500 dark:text-neutral-400">No inspection records cached. Use main sync to fetch data.</p>
                    </div>
                  )}
                  
                  <div className="relative">
                    {inspLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-neutral-900/70">
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-10 w-10 border-2 border-b-transparent border-blue-500"></div>
                          <span className="text-xs text-gray-600 dark:text-neutral-400">Loading inspections…</span>
                        </div>
                      </div>
                    )}
                    <div className={"space-y-3 transition-opacity " + (inspLoading ? "opacity-30" : "opacity-100") + " min-h-[200px]"}>
                      {insp?.map((r, i) => (
                      <div 
                        key={i} 
                        className="bg-gray-50 dark:bg-neutral-800/30 rounded-xl border border-gray-200 dark:border-neutral-700/50 p-4 hover:shadow-sm hover:bg-gray-100 dark:hover:bg-neutral-800/50 transition-all cursor-pointer"
                        onClick={() => openInspectionViewer(i)}
                      >
                        <div className="flex flex-wrap gap-3 justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatDateToDDMMYYYY(r["Date/Time"]) || "Unknown date"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1 space-y-1">
                                {r["Attendance Type"] && (
                                  <div>Type: {r["Attendance Type"]}</div>
                                )}
                                {r.Situation && (
                                  <div>Situation: {r.Situation}</div>
                                )}
                                {r["Water Depth"] && (
                                  <div>Water Depth: {r["Water Depth"]}m</div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {r["Condition Rating"] && (
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                {r["Condition Rating"]}
                              </span>
                            )}
                            <div className="text-xs text-gray-400 dark:text-neutral-500">
                              Click to view details
                            </div>
                          </div>
                        </div>
                        
                        {/* Quick Preview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {r["Inspection Notes"] && (
                            <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg border border-gray-100 dark:border-neutral-700">
                              <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Notes Preview</h4>
                              <p className="text-sm text-gray-700 dark:text-neutral-300 line-clamp-2">
                                {r["Inspection Notes"]}
                              </p>
                            </div>
                          )}
                          {r.Recommendations && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                              <h4 className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Recommendations Preview</h4>
                              <p className="text-sm text-amber-700 dark:text-amber-300 line-clamp-2">
                                {r.Recommendations}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Additional Info Row */}
                        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-neutral-700 text-xs text-gray-500 dark:text-neutral-400">
                          {r["Main Asset Photo"] && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Photo Available
                            </span>
                          )}
                          {r["Asset Status"] && (
                            <span>Status: {r["Asset Status"]}</span>
                          )}
                          {r["Equipment Used"] && (
                            <span>Equipment: {r["Equipment Used"]}</span>
                          )}
                          {r.Key && (
                            <span>Asset: {r.Key}</span>
                          )}
                        </div>
                      </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment Tab */}
              <div className={tab === "equipment" ? "block" : "hidden"}>
                <div className="p-4 sm:p-6">
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-300 dark:text-neutral-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-neutral-300 mb-2">Equipment Records</h3>
                    <p className="text-sm text-gray-500 dark:text-neutral-400 mb-6 max-w-md mx-auto">
                      Equipment data tables are not yet set up. This feature will be available in a future update.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Coming Soon
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced mobile footer */}
            <div className="sticky bottom-0 sm:hidden px-4 py-4 border-t border-gray-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md">
              <button
                className="w-full text-center text-sm px-4 py-3 rounded-xl font-medium bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showImageFull && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowImageFull(false)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImageFull(false)} className="absolute -top-3 -right-3 bg-white dark:bg-neutral-800 rounded-full p-2 shadow hover:shadow-md" aria-label="Close image">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div className="bg-white dark:bg-neutral-900 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-700 p-4">
              <img src="/asset-placeholder.svg" alt="Asset placeholder large" className="mx-auto max-h-[70vh] object-contain" />
              <p className="mt-3 text-center text-xs text-gray-500 dark:text-neutral-400">Placeholder image – will show last service main image when available.</p>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {showImageLightbox && lightboxImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[70] bg-black bg-opacity-95 flex items-center justify-center"
          onTouchStart={handleLightboxTouchStart}
          onTouchMove={handleLightboxTouchMove}
          onTouchEnd={handleLightboxTouchEnd}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image counter */}
            <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              {currentImageIndex + 1} / {lightboxImages.length}
            </div>

            {/* Previous button */}
            {lightboxImages.length > 1 && (
              <button
                onClick={() => navigateImage('prev')}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next button */}
            {lightboxImages.length > 1 && (
              <button
                onClick={() => navigateImage('next')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 w-12 h-12 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Main image */}
            <img
              src={`/api/inspection-images?path=${encodeURIComponent(lightboxImages[currentImageIndex])}`}
              alt="Inspection Image"
              className="max-w-full max-h-full object-contain"
              onClick={closeLightbox}
            />
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-neutral-800/50 rounded-lg border border-gray-200 dark:border-neutral-700/50 p-3 hover:shadow-sm transition-shadow">
      <span className="text-[10px] uppercase tracking-wide font-medium text-gray-500 dark:text-neutral-400 block mb-1">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white break-words font-medium">{value}</span>
    </div>
  );
}

function TabBtn({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        if (disabled) return;
        console.log("Tab button clicked:", children);
        onClick();
      }}
      disabled={disabled}
      className={
        "flex-1 flex items-center justify-center px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap " +
        (disabled
          ? "bg-gray-100 dark:bg-neutral-800/50 text-gray-400 dark:text-neutral-500 cursor-not-allowed opacity-60"
          : active
            ? "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-neutral-700"
            : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/50")
      }
      type="button"
    >
      {children}
    </button>
  );
}

function Small({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-gray-100 dark:border-neutral-700">
      <span className="text-[10px] uppercase tracking-wide font-medium text-gray-500 dark:text-neutral-400 block mb-1">{label}</span>
      <span className="text-xs text-gray-800 dark:text-neutral-200 break-words">{value}</span>
    </div>
  );
}
