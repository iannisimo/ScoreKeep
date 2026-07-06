const CACHE_NAME = "scorekeep-v13";
const ASSETS = [
  "./",
  "styles.css",
  "app.js",
  "manifest.json",
  "icon.svg"
];

// Helper to resolve the root URL relative to the service worker location
const INDEX_URL = new URL("./", self.location.href).href;

// Install Event: Cache app assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Pre-caching offline assets");
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache first with network fallback
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Handle navigation requests by serving the root URL "./"
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(INDEX_URL, { ignoreSearch: true }).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).catch(() => {
          return caches.match(INDEX_URL, { ignoreSearch: true });
        });
      })
    );
    return;
  }

  // Only handle local HTTP/HTTPS requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});
