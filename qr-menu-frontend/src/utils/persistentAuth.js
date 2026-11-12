// Multi-layer permanent credential storage for the Owner App (iOS IPA, Android APK, and Safari PWA).
// Stores tokens across localStorage, native Capacitor Preferences (NSUserDefaults / SharedPreferences),
// IndexedDB, and a 10-year first-party cookie so owners only ever sign in once.

const TOKEN_KEYS = ['qr_admin_token', 'qr_kitchen_token'];
const IDB_NAME = 'krish_owner_auth';
const IDB_STORE = 'tokens';
const COOKIE_MAX_AGE_SECONDS = 315360000; // 10 years

let persistRequested = false;

function requestPersistentBrowserStorage() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  } catch {}
}

function getNativePreferences() {
  try {
    const prefs = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Preferences : null;
    if (prefs && typeof prefs.get === 'function' && typeof prefs.set === 'function') {
      return prefs;
    }
  } catch {}
  return null;
}

function readCookie(key) {
  try {
    if (typeof document === 'undefined' || !document.cookie) return '';
    const prefix = `${encodeURIComponent(key)}=`;
    for (const part of document.cookie.split(';')) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length)) || '';
      }
    }
  } catch {}
  return '';
}

function writeCookie(key, value) {
  try {
    if (typeof document === 'undefined') return;
    if (value) {
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    } else {
      document.cookie = `${encodeURIComponent(key)}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  } catch {}
}

function openTokenDb() {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readIdb(key) {
  const db = await openTokenDb();
  if (!db) return '';
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : '');
      req.onerror = () => resolve('');
      tx.oncomplete = () => db.close();
    } catch {
      resolve('');
    }
  });
}

async function writeIdb(key, value) {
  const db = await openTokenDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      if (value) store.put(value, key);
      else store.delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Synchronous read for instant UI hydration (checks localStorage then long-lived cookie). */
export function getSyncToken(key) {
  try {
    const lsVal = localStorage.getItem(key) || '';
    if (lsVal) return lsVal;
    const cookieVal = readCookie(key);
    if (cookieVal) {
      localStorage.setItem(key, cookieVal);
      return cookieVal;
    }
  } catch {}
  return '';
}

/** Persist token permanently across localStorage, Cookie, IndexedDB, and Native Capacitor Preferences. */
export async function setPersistentToken(key, value) {
  if (!value) return;
  requestPersistentBrowserStorage();
  try {
    localStorage.setItem(key, value);
  } catch {}
  writeCookie(key, value);
  await Promise.allSettled([
    writeIdb(key, value),
    getNativePreferences()?.set({ key, value }),
  ]);
}

/** Remove token from all storage layers (only when user explicitly logs out or token is revoked). */
export async function removePersistentToken(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
  writeCookie(key, '');
  await Promise.allSettled([
    writeIdb(key, ''),
    getNativePreferences()?.remove({ key }),
  ]);
}

/** Restore tokens from the most durable surviving layer into localStorage and return current values. */
export async function hydratePersistentAuth() {
  requestPersistentBrowserStorage();
  const nativePrefs = getNativePreferences();
  const result = {};

  for (const key of TOKEN_KEYS) {
    let val = '';
    try {
      val = localStorage.getItem(key) || '';
    } catch {}

    if (!val && nativePrefs) {
      try {
        const res = await nativePrefs.get({ key });
        val = res?.value || '';
      } catch {}
    }

    if (!val) {
      val = await readIdb(key);
    }

    if (!val) {
      val = readCookie(key);
    }

    if (val) {
      await setPersistentToken(key, val);
    }
    result[key] = val;
  }

  return {
    adminToken: result.qr_admin_token || '',
    kitchenToken: result.qr_kitchen_token || '',
  };
}

