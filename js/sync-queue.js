// 离线动作队列：add/update/delete 先进 IndexedDB，恢复网络后写入第二份备份库。
// 现在没有云后端；以后接云同步时，只需要把 backupActions 换成 API 上传。

const DB_NAME = 'ubudget-queue';
const DB_VERSION = 1;
const PENDING = 'pending-actions';
const BACKUP = 'record-backup';

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDB() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unsupported'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(BACKUP)) db.createObjectStore(BACKUP, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

export async function queueRecordAction(op, record) {
  if (!record?.id) return false;
  try {
    const db = await openDB();
    const action = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      op: op === 'delete' ? 'delete' : 'upsert',
      recordId: record.id,
      record: op === 'delete' ? null : structuredClone(record),
      createdAt: new Date().toISOString(),
    };
    const tx = db.transaction(PENDING, 'readwrite');
    tx.objectStore(PENDING).put(action);
    await txDone(tx);
    db.close();
    scheduleQueueSync();
    return true;
  } catch {
    return false;
  }
}

export async function getQueueCount() {
  try {
    const db = await openDB();
    const count = await req(db.transaction(PENDING, 'readonly').objectStore(PENDING).count());
    db.close();
    return count;
  } catch {
    return 0;
  }
}

async function listPending() {
  const db = await openDB();
  const rows = await req(db.transaction(PENDING, 'readonly').objectStore(PENDING).getAll());
  db.close();
  return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

async function backupActions(rows) {
  const db = await openDB();
  const tx = db.transaction([PENDING, BACKUP], 'readwrite');
  const backup = tx.objectStore(BACKUP);
  const pending = tx.objectStore(PENDING);
  for (const row of rows) {
    if (row.op === 'delete') backup.delete(row.recordId);
    else backup.put(row.record);
    pending.delete(row.id);
  }
  await txDone(tx);
  db.close();
}

async function flushPending() {
  if (!navigator.onLine) return 0;
  const rows = await listPending();
  if (!rows.length) return 0;
  await backupActions(rows);
  return rows.length;
}

let syncing = false;

export async function syncQueue() {
  if (syncing) return 0;
  syncing = true;
  try {
    const count = await flushPending();
    if (count) document.dispatchEvent(new CustomEvent('ubudget:queue-synced', { detail: { count } }));
    return count;
  } catch {
    return 0;
  } finally {
    syncing = false;
  }
}

export function scheduleQueueSync() {
  if (!navigator.onLine) return;
  setTimeout(() => void syncQueue(), 80);
}

export async function registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('ubudget-queue');
    return true;
  } catch {
    return false;
  }
}

// iOS Safari 没有 Background Sync，这里用 online 事件兜底。
window.addEventListener('online', scheduleQueueSync);
