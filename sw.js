// 离线可用：把界面资源缓存起来，断网也能记账。
const CACHE = 'ubudget-v21';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/views.js',
  './js/components.js',
  './js/store.js',
  './js/format.js',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(networkFirst(e.request));
});

// 网络优先，但**带超时**：校园网/弱网卡住时不会让你干等，
// 2.5 秒没响应就直接用缓存把界面开出来，联网后再拿最新的。
const NETWORK_TIMEOUT_MS = 2500;

async function networkFirst(request) {
  const cache = await caches.open(CACHE);

  try {
    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('network-timeout')), NETWORK_TIMEOUT_MS));
    const res = await Promise.race([fetch(request, { cache: 'reload' }), timer]);
    if (res && res.ok) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return Response.error();
  }
}
