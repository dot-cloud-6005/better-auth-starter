"use client";

// Avoid static generation for this route, it relies on browser APIs
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, Marker, LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Asset } from "@/types/asset";

export default function MapPage() {
  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [searchId, setSearchId] = useState<string>("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const firstFixRef = useRef<boolean>(false);
  const assetsRef = useRef<Asset[]>([]);
  const LABEL_MIN_ZOOM = 14; // labels appear from this zoom and above

  // Initial map center near provided sample coordinates
  const startCenter = useMemo<LngLatLike>(() => [117.9635, -34.9604], []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

  // Try preferred online style, fall back to a local blank style offline
  const preferredStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: preferredStyle,
      center: startCenter,
      zoom: 12,
  attributionControl: false,
    });

    if (String(preferredStyle).includes("demotiles.maplibre.org")) {
      map.on("error", (e) => {
        const src = (e as unknown as { source?: { type?: string } } | undefined)?.source ?? {};
        // Only for demo style, if style itself fails, fallback to blank
        const errMsg = String((e as unknown as { error?: unknown })?.error ?? "");
        if ((src && src.type === "style") || errMsg.includes("Failed to fetch")) {
          map.setStyle("/styles/blank.json");
        }
      });
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }));

    mapRef.current = map;

    const SRC_ID = "assets-src";
    const CIRCLE_ID = "assets-circles";
    const LABEL_ID = "assets-labels";
    const USER_ACC_SRC_ID = "user-accuracy-src";
    const USER_ACC_FILL_ID = "user-accuracy-fill";
    const USER_ACC_LINE_ID = "user-accuracy-line";

    // Approximate circle polygon around lon/lat with given radius in meters
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

    const addAssetsSourceAndLayers = () => {
      if (!mapRef.current) return;
      const m = mapRef.current;
      // Ensure source exists
      if (!m.getSource(SRC_ID)) {
        const empty: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
        m.addSource(SRC_ID, { type: "geojson", data: empty });
      }
      // Circle layer for points (always visible)
      if (!m.getLayer(CIRCLE_ID)) {
        m.addLayer({
          id: CIRCLE_ID,
          type: "circle",
          source: SRC_ID,
          paint: {
            // Fill color based on NavAid_Colour or function
            "circle-color": [
              "case",
              // Special Marks: yellow
              ["match", ["downcase", ["get", "NavAid_Colour"]], ["yellow"], true, false], "#facc15",
              // Cardinals: also yellow fill
              [
                "any",
                ["match", ["downcase", ["get", "NavAid_Colour"]], ["black/yellow", "yellow/black"], true, false],
                ["in", "Cardinal", ["get", "NavAid_Primary_Function"]]
              ], "#facc15",
              // Port / Starboard fallback
              ["in", "Port", ["get", "NavAid_Primary_Function"]], "#ef4444",
              ["in", "Starboard", ["get", "NavAid_Primary_Function"]], "#16a34a",
              // Default
              "#2563eb"
            ],
            "circle-radius": 6,
            // Stroke color: black for cardinals, white otherwise
            "circle-stroke-color": [
              "case",
              [
                "any",
                ["match", ["downcase", ["get", "NavAid_Colour"]], ["black/yellow", "yellow/black"], true, false],
                ["in", "Cardinal", ["get", "NavAid_Primary_Function"]]
              ], "#000000",
              "#ffffff"
            ],
            "circle-stroke-width": 2,
          },
        });
        // Cursor feedback
        m.on("mouseenter", CIRCLE_ID, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", CIRCLE_ID, () => (m.getCanvas().style.cursor = ""));
        // Click -> select
        m.on("click", CIRCLE_ID, (e) => {
          const f = e.features && e.features[0];
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
          const id = idNum;
          const full = assetsRef.current.find((a) => a.Asset_Number === id);
          if (full) {
            setSelected(full);
          } else {
            setSelected({
              Asset_Number: id,
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
          }
        });
      }
      // Symbol labels (only when zoomed in)
      if (!m.getLayer(LABEL_ID)) {
        m.addLayer({
          id: LABEL_ID,
          type: "symbol",
          source: SRC_ID,
          minzoom: LABEL_MIN_ZOOM,
          layout: {
            "text-field": ["to-string", ["get", "Asset_Number"]],
            "text-size": 12,
            "text-offset": [0, 1.1],
            "text-anchor": "top",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#111827",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.2,
          },
        });
      }
    };

    const addUserAccuracySourceAndLayers = () => {
      if (!mapRef.current) return;
      const m = mapRef.current;
      if (!m.getSource(USER_ACC_SRC_ID)) {
        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        m.addSource(USER_ACC_SRC_ID, { type: "geojson", data: empty });
      }
      if (!m.getLayer(USER_ACC_FILL_ID)) {
        m.addLayer({
          id: USER_ACC_FILL_ID,
          type: "fill",
          source: USER_ACC_SRC_ID,
          paint: {
            "fill-color": "#3b82f6",
            "fill-opacity": 0.15,
          },
        });
      }
      if (!m.getLayer(USER_ACC_LINE_ID)) {
        m.addLayer({
          id: USER_ACC_LINE_ID,
          type: "line",
          source: USER_ACC_SRC_ID,
          paint: {
            "line-color": "#3b82f6",
            "line-width": 2,
            "line-opacity": 0.7,
          },
        });
      }
      return { circlePolygon };
    };

    const onLoad = () => {
      addAssetsSourceAndLayers();
      addUserAccuracySourceAndLayers();
    };
    const onStyle = () => {
      addAssetsSourceAndLayers();
      addUserAccuracySourceAndLayers();
    };
    map.on("load", onLoad);
    map.on("styledata", onStyle);

    return () => {
      map.off("load", onLoad);
      map.off("styledata", onStyle);
      map.remove();
      mapRef.current = null;
    };
  }, [startCenter]);

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

  // Update GeoJSON source when assets change and fit bounds
  useEffect(() => {
  assetsRef.current = assets;
    const map = mapRef.current;
    if (!map) return;
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
    const trySet = () => {
      const s = map.getSource("assets-src") as maplibregl.GeoJSONSource | undefined;
      if (s) {
        s.setData(fc);
        map.off("styledata", trySet);
        map.off("load", trySet);
      }
    };
    // Set immediately if present, otherwise wait for style to be ready
    trySet();
    map.on("styledata", trySet);
    map.on("load", trySet);

    // Fit to bounds of assets
    if (assets.length > 0) {
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
          map.fitBounds(bounds as maplibregl.LngLatBoundsLike, { padding: 40, maxZoom: 14, duration: 800 });
        } catch {}
      }
    }
    return () => {
      map.off("styledata", trySet);
      map.off("load", trySet);
    };
  }, [assets]);

  // High-accuracy tracking toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!tracking) {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
  firstFixRef.current = false;
      return;
    }

    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported by this browser");
      return;
    }

  // Mark that the next position we get is the first fix after enabling
  firstFixRef.current = true;

  watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let marker = userMarkerRef.current;
        if (!marker) {
          const el = document.createElement("div");
          el.style.width = "16px";
          el.style.height = "16px";
          el.style.borderRadius = "9999px";
          el.style.backgroundColor = "#ef4444"; // red dot
          el.style.border = "2px solid white";
          marker = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map);
          userMarkerRef.current = marker;
        } else {
          marker.setLngLat([longitude, latitude]);
        }
        // On the first fix after enabling, also zoom in to at least 16
        if (firstFixRef.current) {
          const currentZoom = map.getZoom ? map.getZoom() : 0;
          const targetZoom = Math.max(16, Number.isFinite(currentZoom) ? currentZoom : 0);
          map.easeTo({ center: [longitude, latitude], zoom: targetZoom, duration: 600 });
          firstFixRef.current = false;
        } else {
          map.easeTo({ center: [longitude, latitude], duration: 500 });
        }
        setAccuracy(Number.isFinite(accuracy) ? Math.round(accuracy) : null);
        // Update accuracy circle layer
        const src = map.getSource("user-accuracy-src") as maplibregl.GeoJSONSource | undefined;
        if (src) {
          const feature = ((): GeoJSON.Feature | null => {
            if (!Number.isFinite(accuracy) || accuracy == null) return null;
            // Limit absurdly large radii to avoid performance issues
            const clamped = Math.min(accuracy, 1000);
            // Use the helper defined in setup scope
            const poly = (function () {
              const degLat = clamped / 111320;
              const degLonFactor = Math.cos((latitude * Math.PI) / 180);
              const degLon = degLat / Math.max(0.000001, degLonFactor);
              const steps = 64;
              const coords: [number, number][] = [];
              for (let i = 0; i <= steps; i++) {
                const theta = (i / steps) * 2 * Math.PI;
                const dx = Math.cos(theta) * degLon;
                const dy = Math.sin(theta) * degLat;
                coords.push([longitude + dx, latitude + dy]);
              }
              return {
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [coords] },
                properties: {},
              } as GeoJSON.Feature<GeoJSON.Polygon>;
            })();
            return poly as GeoJSON.Feature;
          })();
          const fc: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: feature ? [feature] : [],
          };
          src.setData(fc);
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
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [tracking]);

  // Keyboard: allow closing modal with Escape
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

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
        {/* Right group: tracking + desktop search */}
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
          <button
            onClick={() => setTracking((v) => !v)}
            className={`px-3 py-1.5 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
              tracking
                ? "bg-green-600 text-white border-green-600 dark:border-green-600"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-700"
            }`}
          >
            {tracking ? "Disable" : "Enable"} tracking
          </button>
          {tracking && (
            <span className="text-sm px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200">
              {accuracy != null ? `±${accuracy} m` : "--"}
            </span>
          )}
          {loading && <span className="text-muted-foreground text-sm">Loading…</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
          {searchError && <span className="text-red-600 text-sm">{searchError}</span>}
        </div>
      </div>
  <div className="relative w-full h-full min-h-[400px] rounded overflow-hidden border">
    <div ref={containerRef} className="w-full h-full" />
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
      © OpenStreetMap contributors, © MapTiler
    </div>
  </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white text-black dark:bg-neutral-900 dark:text-white w-full sm:max-w-2xl h-[85dvh] sm:h-auto max-h-[90dvh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="sm:hidden pt-2 flex justify-center">
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-neutral-700" />
            </div>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 px-4 py-3 border-b border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold truncate">#{selected.Asset_Number} - {selected.Location_Code}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{selected.NavAid_Name || "Asset"}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{selected.NavAid_Primary_Function} - {selected.Situation}</p>
              </div>
              <button
                className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              
              {selected.Risk_Category != null && (
                <Field label="Risk Category" value={String(selected.Risk_Category)} />
              )}

              <Field label="Latitude" value={selected.Latitude.toFixed(6)} />
              <Field label="Longitude" value={selected.Longitude.toFixed(6)} />

              
              

              
              
              {selected.Chart_Character && <Field label="Chart Character" value={selected.Chart_Character} />}
              {selected.Flash_Sequence && <Field label="Flash Sequence" value={selected.Flash_Sequence} />}
              {selected.Light_Range && <Field label="Light Range" value={selected.Light_Range} />}
              {selected.Light_Colour && <Field label="Light Colour" value={selected.Light_Colour} />}
              {selected.Lead_Bearing && <Field label="Lead Bearing" value={selected.Lead_Bearing} />}
              
              {selected.STATUS && <Field label="Status" value={selected.STATUS} />}
              
              {selected.Northing != null && <Field label="Northing" value={String(selected.Northing)} />}
              {selected.Easting != null && <Field label="Easting" value={String(selected.Easting)} />}
              {selected.UTM_Zone != null && <Field label="UTM Zone" value={String(selected.UTM_Zone)} />}            
              
              {selected.Daymark && <Field label="Daymark" value={selected.Daymark} />}
              {selected.Mark_Structure && <Field label="Mark Structure" value={selected.Mark_Structure} />}
              
              {selected.Infrastructure_Subgroup_Code && (
                <Field label="Infrastructure Subgroup Code" value={selected.Infrastructure_Subgroup_Code} />
              )}
              {selected.Function_Code && <Field label="Function Code" value={selected.Function_Code} />}
              {selected.Horizontal_Accuracy && (
                <Field label="Horizontal Accuracy" value={selected.Horizontal_Accuracy} />
              )}
              {selected.Responsible_Agency && <Field label="Responsible Agency" value={selected.Responsible_Agency} />}
              {selected.OWNER && <Field label="Owner" value={selected.OWNER} />}
              {selected.NavAid_Shape && <Field label="NavAid Shape" value={selected.NavAid_Shape} />}
              {selected.NavAid_Colour && <Field label="NavAid Colour" value={selected.NavAid_Colour} />}
              {selected.AIS_Type && <Field label="AIS Type" value={selected.AIS_Type} />}
              {selected.MMSI_Number && <Field label="MMSI Number" value={selected.MMSI_Number} />}
              </div>
            </div>

            {/* Sticky footer close on mobile */}
            <div className="sticky bottom-0 sm:hidden px-4 py-3 border-t border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
              <button
                className="w-full text-center text-sm px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
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
    <div className="flex flex-col rounded border border-gray-200 dark:border-neutral-800 p-2">
      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-neutral-400">{label}</span>
      <span className="text-sm break-words">{value}</span>
    </div>
  );
}
