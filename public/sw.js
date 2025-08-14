// Minimal no-op service worker to override any previous registrations.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Clear any caches left by older SWs
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    // Take control of uncontrolled clients ASAP
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  // Passthrough: don't intercept requests
  return;
});
