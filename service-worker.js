const CACHE_NAME = 'bot-tradefx-v2.5';
const OTA_CACHE_NAME = 'bot-tradefx-ota';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
  './css/style.css',
  './js/app.js',
  './js/botEngine.js',
  './js/brokerService.js',
  './js/historyService.js',
  './js/strategyService.js',
  './js/audioService.js',
  './js/accountService.js',
  './js/updaterService.js',
  './assets/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== OTA_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let WebSocket / API calls bypass cache
  if (!event.request.url.startsWith('http') || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    // 1. Check if newer OTA update cache exists
    caches.open(OTA_CACHE_NAME).then((otaCache) => {
      return otaCache.match(event.request).then((otaRes) => {
        if (otaRes) return otaRes;

        // 2. Otherwise fall back to default cache or network
        return caches.match(event.request).then((cachedRes) => {
          return cachedRes || fetch(event.request);
        });
      });
    })
  );
});

// Listen for message from app to clear OTA cache or activate immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
