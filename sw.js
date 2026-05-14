/* Qrents Pro - Service Worker (sw.js) */

const CACHE_VERSION = 'v1';
const CACHE_NAME    = `qrents-${CACHE_VERSION}`;
const API_CACHE     = `qrents-api-${CACHE_VERSION}`;

// Aset statis yang di-cache saat install
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app-api.js',
  './manifest.json',
];

// URL prefix yang dianggap sebagai API call (network-first)
const API_ORIGINS = [
  'https://api.',
  '/api/',
  '/auth/',
];

// ========== INSTALL ==========
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Qrents Pro Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        // Gunakan addAll dengan fallback individual agar 1 aset gagal tidak abort semua
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('qrents-') && name !== CACHE_NAME && name !== API_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ========== FETCH ==========
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  const isApiCall = API_ORIGINS.some(prefix =>
    url.href.includes(prefix) || url.pathname.startsWith('/api')
  );

  if (isApiCall) {

    event.respondWith(networkFirst(request, API_CACHE));
  } else {

    event.respondWith(cacheFirst(request, CACHE_NAME));
  }
});

// ========== STRATEGIES ==========
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    updateCacheInBackground(request, cacheName);
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const offlinePage = await caches.match('./index.html');
    return offlinePage || new Response('Tidak ada koneksi internet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/**
 * Network-first: cocok untuk API calls agar data selalu fresh
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline — data tidak tersedia' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Background update (stale-while-revalidate helper)
 */
function updateCacheInBackground(request, cacheName) {
  fetch(request)
    .then(async (response) => {
      if (response && response.status === 200) {
        const cache = await caches.open(cacheName);
        cache.put(request, response);
      }
    })
    .catch(() => {}); // Abaikan error saat offline
}

// ========== PUSH NOTIFICATIONS (opsional, siap dipakai) ==========
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Qrents Pro', {
      body: data.body || 'Ada notifikasi baru',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      tag: data.tag || 'qrents-notif',
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});