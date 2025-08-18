"use client";

// Avoid static generation for this route, it relies on browser APIs
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InspectionRecord, EquipmentRecord } from "@/types/navapp";
import type { Asset } from "@/types/asset";
import { formatDateToDDMMYYYY } from "@/lib/utils";
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
  const [inspLoading, setInspLoading] = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);
  const [inspError, setInspError] = useState<string | null>(null);
  const [equipError, setEquipError] = useState<string | null>(null);
  const fetchedInspFor = useRef<number | null>(null);
  const fetchedEquipFor = useRef<number | null>(null);
  const assetsRef = useRef<Asset[]>([]);
  const userPosRef = useRef<{ lon: number; lat: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState(false);

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

  const refreshInspections = () => {
    if (!selected) return;
    fetchedInspFor.current = null;
    setInsp(null);
    setInspError(null);
  };

  const refreshEquipment = () => {
    if (!selected) return;
    fetchedEquipFor.current = null;
    setEquip(null);
    setEquipError(null);
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
    const controller = new AbortController();
    fetch("/api/assets", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        return body.data as Asset[];
      })
      .then((data) => {
        if (cancelled) return;
  setAssets(data ?? []);
  assetsRef.current = data ?? [];
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message ?? String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Reset tab data on selection change; keep Asset tab as default
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
  }, [selected]); // Use full selected object since we check if it exists

  // Lazy-load inspections when tab is opened
  useEffect(() => {
    // Don't run if we don't have what we need
    if (!selected || tab !== "inspect") {
      console.log("Skipping inspection fetch", { hasSelected: !!selected, tab });
      return;
    }

    // Don't run if we already have data for this asset
    if (insp !== null && fetchedInspFor.current === selected.Asset_Number) {
      console.log("Already have inspection data for asset", selected.Asset_Number);
      return;
    }

    // Don't run if we're already loading for this asset
    if (inspLoading && fetchedInspFor.current === selected.Asset_Number) {
      console.log("Already loading inspections for asset", selected.Asset_Number);
      return;
    }

    console.log("Starting inspection fetch for asset", selected.Asset_Number);
    
    let isCancelled = false;
    const ctrl = new AbortController();
    
    setInspLoading(true);
    setInspError(null);
    fetchedInspFor.current = selected.Asset_Number;
    
    const url = `/api/navapp/inspections/${selected.Asset_Number}`;
    console.log("Fetching inspections from:", url);
    
    fetch(url, { signal: ctrl.signal })
      .then((r) => {
        if (isCancelled) return;
        console.log("Inspection fetch response:", r.status, r.ok);
        return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
      })
      .then((j) => {
        if (isCancelled) return;
        console.log("Inspection data received:", j);
        setInsp(j?.data ?? []);
        setInspSource(j?.meta?.source ?? null);
        try { console.debug("Inspect fetched", { asset: selected.Asset_Number, count: (j?.data ?? []).length, source: j?.meta?.source }); } catch {}
      })
      .catch((e) => {
        if (isCancelled) return;
        console.error("Inspection fetch error:", e);
        if (!ctrl.signal.aborted) {
          setInspError(e?.message || String(e));
          // prevent endless retry loop by marking as loaded with empty data
          setInsp([]);
          setInspSource('none');
          try { console.debug("Inspect fetch error", { asset: selected.Asset_Number, error: String(e) }); } catch {}
        } else {
          console.log("Fetch was aborted, not setting error state");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          console.log("Inspection fetch completed");
          setInspLoading(false);
        }
      });
    
    return () => {
      console.log("Cleaning up inspection fetch");
      isCancelled = true;
      ctrl.abort();
    };
  }, [tab, selected?.Asset_Number]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load equipment when tab is opened
  useEffect(() => {
    // Don't run if we don't have what we need
    if (!selected || tab !== "equipment") {
      return;
    }

    // Don't run if we already have data for this asset
    if (equip !== null && fetchedEquipFor.current === selected.Asset_Number) {
      return;
    }

    // Don't run if we're already loading for this asset
    if (equipLoading && fetchedEquipFor.current === selected.Asset_Number) {
      return;
    }

    let isCancelled = false;
    const ctrl = new AbortController();
    
    setEquipLoading(true);
    setEquipError(null);
    fetchedEquipFor.current = selected.Asset_Number;
    
    fetch(`/api/navapp/equipment/${selected.Asset_Number}`, { signal: ctrl.signal })
      .then((r) => {
        if (isCancelled) return;
        return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
      })
      .then((j) => {
        if (isCancelled) return;
        setEquip(j?.data ?? []);
        try { console.debug("Equipment fetched", { asset: selected.Asset_Number, count: (j?.data ?? []).length }); } catch {}
      })
      .catch((e) => {
        if (isCancelled) return;
        if (!ctrl.signal.aborted) {
          setEquipError(e?.message || String(e));
          // prevent endless retry loop by marking as loaded with empty data
          setEquip([]);
          try { console.debug("Equipment fetch error", { asset: selected.Asset_Number, error: String(e) }); } catch {}
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setEquipLoading(false);
        }
      });
    
    return () => {
      isCancelled = true;
      ctrl.abort();
    };
  }, [tab, selected?.Asset_Number]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update GeoJSON source when assets change and fit bounds
  const [assetsGeo, setAssetsGeo] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({ type: "FeatureCollection", features: [] });
  const [accuracyGeo, setAccuracyGeo] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });

  useEffect(() => {
    assetsRef.current = assets;
    setMapReady(false);
    const fc: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: assets.map((a) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.Longitude, a.Latitude] },
        properties: {
          Asset_Number: a.Asset_Number,
          NavAid_Name: a.NavAid_Name,
          NavAid_Primary_Function: a.NavAid_Primary_Function,
          STATUS: a.STATUS ?? "",
          Location_Code: a.Location_Code,
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
      })),
    };
    setAssetsGeo(fc);

    // Fit to bounds of assets
    if (assets.length > 0 && mapRef.current) {
      const bounds = assets.reduce(
        (b, a) => {
          b[0][0] = Math.min(b[0][0], a.Longitude);
          b[0][1] = Math.min(b[0][1], a.Latitude);
          b[1][0] = Math.max(b[1][0], a.Longitude);
          b[1][1] = Math.max(b[1][1], a.Latitude);
          return b;
        },
        [
          [Infinity, Infinity],
          [-Infinity, -Infinity],
        ] as [number, number][]
      );
      if (Number.isFinite(bounds[0][0]) && Number.isFinite(bounds[1][0])) {
        try {
          const tuple: [[number, number], [number, number]] = [
            [bounds[0][0], bounds[0][1]],
            [bounds[1][0], bounds[1][1]],
          ];
          mapRef.current.fitBounds(tuple, { padding: 40, maxZoom: 14, duration: 800 });
          setTimeout(() => setMapReady(true), 850);
        } catch {}
      }
    } else {
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
    const features = (e as MapClickEvent)?.features as Array<{ properties?: Record<string, unknown>; geometry?: GeoJSON.Geometry }> | undefined;
    const f = features && features[0];
    if (!f) return;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
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
  }, []);

  return (
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
          {loading && <span className="text-muted-foreground text-sm">Loading…</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
          {searchError && <span className="text-red-600 text-sm">{searchError}</span>}
        </div>
      </div>
      {showTokenWarning && (
        <div className="mx-2 sm:mx-4 -mt-2 mb-1 rounded border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-3 py-2 text-xs">
          Mapbox token is missing. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or NEXT_PUBLIC_MAPBOX_TOKEN) in your environment, or include access_token in your style URL.
        </div>
      )}
  <div className="relative w-full h-full min-h-[400px] rounded overflow-hidden border">
    <ReactMap
      ref={mapRef}
  mapboxAccessToken={effectiveToken}
      mapStyle={mapStyle}
      initialViewState={startCenter}
      onMove={(evt) => setViewState(evt.viewState)}
      onLoad={() => setMapReady(true)}
      onError={(e: unknown) => {
        let msg = "Map load error";
        if (typeof e === "object" && e !== null) {
          const err = e as { error?: { message?: unknown }; type?: unknown };
          msg = typeof err?.error?.message === "string" ? err.error.message :
                typeof err?.type === "string" ? err.type : msg;
        }
        setError(msg);
      }}
      {...viewState}
  interactiveLayerIds={["assets-circles"]}
  onClick={onMapClick}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="top-left" showCompass={true} />
      {/* Assets */}
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

      {/* Accuracy circle */}
      <Source id="user-accuracy-src" type="geojson" data={accuracyGeo}>
        <Layer id="user-accuracy-fill" type="fill" paint={{ "fill-color": "#3b82f6", "fill-opacity": 0.15 }} />
        <Layer id="user-accuracy-line" type="line" paint={{ "line-color": "#3b82f6", "line-width": 2, "line-opacity": 0.7 }} />
      </Source>

      {/* User marker */}
      {userPosRef.current && (
        <RglMarker longitude={userPosRef.current.lon} latitude={userPosRef.current.lat} anchor="center">
          <div style={{ width: 16, height: 16, borderRadius: 9999, backgroundColor: "#ef4444", border: "2px solid white" }} />
        </RglMarker>
      )}
    </ReactMap>
    
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
    
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
      © Mapbox, © OpenStreetMap contributors
    </div>
  </div>

  {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white text-black dark:bg-neutral-900 dark:text-white w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[92vh] sm:h-auto max-h-[95vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-neutral-800"
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
            <div className="px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-neutral-800/50">
              <div className="flex space-x-1 bg-gray-100 dark:bg-neutral-800/50 rounded-xl p-1">
                <TabBtn active={tab === "asset"} onClick={() => {
                  console.log("Setting tab to: asset");
                  setTab("asset");
                }}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Asset Details
                </TabBtn>
                <TabBtn active={tab === "inspect"} onClick={() => {
                  console.log("Setting tab to: inspect");
                  setTab("inspect");
                }}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Inspections
                  {insp && insp.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      {insp.length}
                    </span>
                  )}
                </TabBtn>
                <TabBtn active={tab === "equipment"} onClick={() => {
                  console.log("Setting tab to: equipment");
                  setTab("equipment");
                }}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Equipment
                  {equip && equip.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      {equip.length}
                    </span>
                  )}
                </TabBtn>
              </div>
            </div>

            {/* Enhanced content area */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain">
              {tab === "asset" && (
                <div className="p-4 sm:p-6 space-y-6">
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
              )}

              {tab === "inspect" && (
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
                            {insp ? `${insp.length} record${insp.length === 1 ? '' : 's'}` : '—'}
                            {inspSource && ` from ${inspSource}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {!inspLoading && (
                      <button
                        type="button"
                        onClick={refreshInspections}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                        title="Refresh inspections"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    )}
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
                      <p className="text-sm text-gray-500 dark:text-neutral-400">No inspection records available</p>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {insp?.map((r, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-neutral-800/30 rounded-xl border border-gray-200 dark:border-neutral-700/50 p-4 hover:shadow-sm transition-shadow">
                        <div className="flex flex-wrap gap-3 justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatDateToDDMMYYYY(r["Date/Time"]) || "Unknown date"}
                              </div>
                              {r["Attendance Type"] && (
                                <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                                  {r["Attendance Type"]}
                                </div>
                              )}
                            </div>
                          </div>
                          {r["Condition Rating"] && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                              {r["Condition Rating"]}
                            </span>
                          )}
                        </div>
                        {r["Inspection Notes"] && (
                          <div className="mb-3">
                            <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Notes</h4>
                            <p className="text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap bg-white dark:bg-neutral-800 p-3 rounded-lg border border-gray-100 dark:border-neutral-700">
                              {r["Inspection Notes"]}
                            </p>
                          </div>
                        )}
                        {r.Recommendations && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Recommendations</h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                              {r.Recommendations}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "equipment" && (
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Equipment Records</h3>
                    {!equipLoading && (
                      <button
                        type="button"
                        onClick={refreshEquipment}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                        title="Refresh equipment"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    )}
                  </div>
                  
                  {equipLoading && (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="ml-3 text-sm text-gray-500">Loading equipment…</span>
                    </div>
                  )}
                  
                  {equipError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{equipError}</p>
                    </div>
                  )}
                  
                  {(!equipLoading && (!equip || equip.length === 0)) && (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-400 dark:text-neutral-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-neutral-400">No equipment records available</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {equip?.map((e, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-neutral-800/30 rounded-xl border border-gray-200 dark:border-neutral-700/50 p-4 hover:shadow-sm transition-shadow">
                        {e["Equipment Type"] && (
                          <div className="flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-semibold text-gray-900 dark:text-white">{e["Equipment Type"]}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {e["Light Make"] && <Small label="Light Make" value={e["Light Make"]} />}
                          {e["Light Model"] && <Small label="Light Model" value={e["Light Model"]} />}
                          {e["Light Colour"] && <Small label="Light Colour" value={e["Light Colour"]} />}
                          {e["Light Install Date"] && <Small label="Light Install" value={formatDateToDDMMYYYY(e["Light Install Date"])} />}
                          {e["Battery Type"] && <Small label="Battery" value={`${e["Battery Type"]} ${e["Battery Qty"] ?? ""}`.trim()} />}
                          {e["Battery Install Date"] && <Small label="Battery Install" value={formatDateToDDMMYYYY(e["Battery Install Date"])} />}
                          {e["Buoy Type"] && <Small label="Buoy Type" value={e["Buoy Type"]} />}
                          {e["Buoy Install Date"] && <Small label="Buoy Install" value={formatDateToDDMMYYYY(e["Buoy Install Date"])} />}
                          {e["Mains Power Onsite"] && <Small label="Mains Power" value={e["Mains Power Onsite"]} />}
                          {e["Last Service"] && <Small label="Last Service" value={formatDateToDDMMYYYY(e["Last Service"])} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
    </div>
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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        console.log("Tab button clicked:", children);
        onClick();
      }}
      className={
        "flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 " +
        (active
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
