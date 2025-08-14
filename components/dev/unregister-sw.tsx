"use client";

import { useEffect } from "react";

/**
 * Dev-only helper to unregister any existing Service Workers on this origin.
 * This prevents stale SWs from other projects from hijacking asset requests
 * (e.g., causing duplicated /_next/_next paths and ChunkLoadError in dev).
 */
export default function UnregisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Only run in development and on localhost-like hosts
    const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    if (process.env.NODE_ENV !== "development" && !isLocalhost) return;

    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          try {
            await reg.unregister();
          } catch {}
        }
        // Also try to remove any caches created by a rogue SW
        if ("caches" in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch {}
        }
        // Reload once to ensure the page is no longer controlled by an SW
        // Avoid infinite reloads by only doing it once per session
        if (!sessionStorage.getItem("__sw_unregistered_once__")) {
          sessionStorage.setItem("__sw_unregistered_once__", "1");
          window.location.reload();
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return null;
}
