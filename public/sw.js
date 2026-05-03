const CACHE_NAME = "trackly-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/icon.svg",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first strategy with offline fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests and non-http(s) URLs
  if (request.method !== "GET" || !request.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          // Cache successful responses for static assets
          if (
            networkResponse.ok &&
            (request.destination === "script" ||
              request.destination === "style" ||
              request.destination === "image" ||
              request.destination === "document")
          ) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for document requests
          if (request.mode === "navigate" || request.destination === "document") {
            return caches.match("/");
          }
          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain" },
          });
        });
    })
  );
});
