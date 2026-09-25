// 离线可用：把界面资源缓存起来，断网也能记账。
const CACHE = 'ubudget-v28';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/views.js',
  './js/components.js',
  './js/store.js',
  './js/sync-queue.js',
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

// Background Sync 在支持的浏览器里排队；iOS Safari 由页面的 online 事件兜底。
self.addEventListener('sync', (event) => {
  if (event.tag === 'ubudget-queue') {
    event.waitUntil(syncQueueInSW());
  }
});

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ubudget-queue', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending-actions')) {
        db.createObjectStore('pending-actions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('record-backup')) {
        db.createObjectStore('record-backup', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txToPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function syncQueueInSW() {
  const run = async () => {
    if (!navigator.onLine) return;
    const db = await openQueueDB();
    const rows = await requestToPromise(
      db.transaction('pending-actions', 'readonly').objectStore('pending-actions').getAll()
    );
    if (!rows.length) {
      db.close();
      return;
    }
    rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const tx = db.transaction(['pending-actions', 'record-backup'], 'readwrite');
    const backup = tx.objectStore('record-backup');
    const pending = tx.objectStore('pending-actions');
    for (const row of rows) {
      if (row.op === 'delete') backup.delete(row.recordId);
      else backup.put(row.record);
      pending.delete(row.id);
    }
    await txToPromise(tx);
    db.close();
    const clients = await self.clients.matchAll();
    clients.forEach((client) => client.postMessage({ type: 'UBUDGET_QUEUE_SYNCED', count: rows.length }));
  };

  if ('locks' in navigator) {
    return navigator.locks.request('ubudget-queue-sync', run);
  }
  return run();
}

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
