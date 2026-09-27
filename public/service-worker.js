const CACHE_NAME = 'quavix-pwa-v2'; // Updated version to trigger install

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Pre-cache the minimal required resources
            return cache.addAll([
                '/',
                '/manifest.json',
                '/offline.html'
            ]);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Network-first approach with cache fallback for offline support
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // If the request is for an HTML page (navigation), serve the offline page
                    if (event.request.mode === 'navigate' || 
                        (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
                        return caches.match('/offline.html');
                    }
                });
            })
    );
});
