// Persist FileSystemFileHandle objects across reloads via IndexedDB, plus
// a lightweight metadata index in localStorage. When the user re-opens, we
// re-request permission (one click) before reading.

import type { FileHandle } from './fileSystem';

const DB_NAME = 'diagrama-fs';
const STORE = 'handles';
const META_KEY = 'diagrama:recent-files';
const MAX_RECENT = 8;

export type RecentMeta = {
  id: string;
  name: string;
  addedAt: number;
};

function dbReady(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRaw(id: string, handle: FileHandle): Promise<void> {
  const db = await dbReady();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRaw(id: string): Promise<FileHandle | null> {
  const db = await dbReady();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function delRaw(id: string): Promise<void> {
  const db = await dbReady();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getRecentList(): RecentMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentMeta[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeRecentList(list: RecentMeta[]) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Promote (or insert) a recent file. Returns the assigned id. */
export async function rememberRecent(handle: FileHandle, name: string): Promise<string> {
  const list = getRecentList();
  // De-dupe by name (best signal we have without comparing handles).
  const existing = list.find((r) => r.name === name);
  const id = existing?.id ?? `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await putRaw(id, handle);
  const next: RecentMeta[] = [
    { id, name, addedAt: Date.now() },
    ...list.filter((r) => r.id !== id),
  ].slice(0, MAX_RECENT);
  writeRecentList(next);
  // GC orphan handles (in list before but pushed out)
  for (const old of list) {
    if (!next.find((r) => r.id === old.id)) {
      try {
        await delRaw(old.id);
      } catch {
        /* ignore */
      }
    }
  }
  return id;
}

/** Remove a recent entry (e.g. file no longer exists / permission denied). */
export async function forgetRecent(id: string): Promise<void> {
  const list = getRecentList();
  writeRecentList(list.filter((r) => r.id !== id));
  try {
    await delRaw(id);
  } catch {
    /* ignore */
  }
}

/**
 * Re-open a remembered file. Re-requests permission (one click prompt) and
 * reads the latest contents from disk.
 */
export async function reopenRecent(
  id: string,
): Promise<{ handle: FileHandle; content: string; name: string } | null> {
  const handle = await getRaw(id);
  if (!handle) return null;
  const h = handle as {
    queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    getFile: () => Promise<File>;
    name: string;
  };
  if (h.queryPermission) {
    const q = await h.queryPermission({ mode: 'readwrite' });
    if (q !== 'granted') {
      const r = h.requestPermission ? await h.requestPermission({ mode: 'readwrite' }) : 'denied';
      if (r !== 'granted') return null;
    }
  }
  try {
    const file = await h.getFile();
    const content = await file.text();
    return { handle, content, name: h.name };
  } catch {
    // File moved / deleted — drop from recents
    await forgetRecent(id);
    return null;
  }
}
