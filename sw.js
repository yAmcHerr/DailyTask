const APP_SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

// Single source of truth for the version is manifest.json's "version" field —
// index.html reads the same field for its About screen, so the two can never
// drift out of sync by someone updating one file and forgetting the other.
// FALLBACK_CACHE_NAME only matters if manifest.json is ever unreachable.
const FALLBACK_CACHE_NAME = 'todo-tracker-v2.7.1.0';
let cacheNamePromise = null;
function getCacheName(){
  if(!cacheNamePromise){
    cacheNamePromise = fetch('./manifest.json')
      .then((res) => res.json())
      .then((data) => (data.version ? 'todo-tracker-v' + data.version : FALLBACK_CACHE_NAME))
      .catch(() => FALLBACK_CACHE_NAME);
  }
  return cacheNamePromise;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    getCacheName().then((name) => caches.open(name).then((cache) => cache.addAll(APP_SHELL)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    getCacheName().then((name) =>
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== name).map((k) => caches.delete(k)))
      )
    )
  );
  self.clients.claim();
});

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          getCacheName().then((name) => caches.open(name)).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          getCacheName().then((name) => caches.open(name)).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
