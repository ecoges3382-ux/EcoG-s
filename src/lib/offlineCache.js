// src/lib/offlineCache.js
const DB_NAME = 'ecoges_offline_db';
const STORE_NAME = 'cache';
const DB_VERSION = 1;

// 🚀 OPTIMISATION : On garde la connexion ouverte en mémoire
let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }
  return dbPromise;
}

export async function saveCache(key, data) {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ data, savedAt: Date.now() }, key);
  } catch (err) {
    console.warn("Erreur cache:", err);
  }
}

export async function loadCache(key) {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

export async function guardedFetch({ cacheKey, hasData, load, setData, setOffline, onError, onSuccess, isCancelled }) {
  let effectiveHasData = hasData;
  
  if (!effectiveHasData) {
    const cached = await loadCache(cacheKey);
    if (cached) {
      if (typeof setData === 'function') setData(cached.data);
      if (typeof setOffline === 'function') setOffline(true);
      effectiveHasData = true;
    }
  }
  
  const { data, error } = await load();
  
  if (typeof isCancelled === 'function' && isCancelled()) return;
  
  if (error) {
    if (effectiveHasData) {
      if (typeof setOffline === 'function') setOffline(true);
      return;
    }
    if (typeof onError === 'function') onError(error);
    return;
  }
  
  if (typeof setData === 'function') setData(data);
  saveCache(cacheKey, data); // 👈 On ne bloque PLUS l'affichage pour sauvegarder en cache
  if (typeof setOffline === 'function') setOffline(false);
  if (typeof onSuccess === 'function') onSuccess(data);
}
