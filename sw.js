// Rocket Rush service worker
// Bump CACHE_NAME whenever you change the game code to force an update.
// Keep this in sync with GAME_VERSION in index.html.
const CACHE_NAME = 'rocket-rush-v0.25.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // v0.24.0 — never intercept the leaderboard API: it must always hit the
  // network (fresh data, and POSTs must reach the function). Let the browser
  // handle it directly rather than routing through the cache-first logic.
  if (e.request.url.includes('/.netlify/functions/')) return;
  // Cache-first strategy — perfect for a static game
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});