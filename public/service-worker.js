// Kill-switch service worker.
// Replaces any previously-shipped SW (e.g. from vite-plugin-pwa) so devices
// that still have it registered will self-evict on next visit.
//
// Browsers re-fetch the SW script at most every 24h, so within one cycle
// every previously-affected client will pick this up, drop all caches, and
// unregister itself. Keep this file in place for at least one release cycle
// before removing.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Take control of any open clients immediately.
      await self.clients.claim();

      // Wipe every Cache Storage entry this SW might have created.
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
      } catch {
        // ignore
      }

      // Force-reload all controlled clients so they fetch fresh HTML/JS
      // BEFORE we unregister (otherwise they keep the stale shell in memory).
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map((client) => {
            try {
              const url = new URL(client.url);
              url.searchParams.set("sw-cleanup", Date.now().toString());
              return client.navigate(url.toString()).catch(() => undefined);
            } catch {
              return undefined;
            }
          })
        );
      } catch {
        // ignore
      }

      // Finally remove ourselves so future visits never hit a SW again.
      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }
    })()
  );
});

// Pass through every fetch untouched while we're still alive — never serve
// from cache. This guarantees no stale responses during the brief window
// between activate and unregister.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
