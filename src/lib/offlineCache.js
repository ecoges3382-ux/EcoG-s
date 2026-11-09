// Ce fichier utilise IndexedDB (illimité) au lieu de localStorage (limité à 5 Mo)
// L'API (saveCache, loadCache, guardedFetch) reste 100% identique pour le reste de l'app.

const DB_NAME = 'ecoges_offline_db';
const STORE_NAME = 'cache';
const DB_VERSION = 1;

// 1. Initialiser la base de données
function getDB() {
  return new Promise((resolve, reject) => {
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

// 2. Sauvegarder une donnée
export async function saveCache(key, data) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ data, savedAt: Date.now() }, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Impossible de sauvegarder en cache :", err);
  }
}

// 3. Lire une donnée
export async function loadCache(key) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
}

// 4. La fonction principale (mise à jour pour être asynchrone)
export async function guardedFetch({ cacheKey, hasData, load, setData, setOffline, onError, onSuccess, isCancelled }) {
  let effectiveHasData = hasData;
  
  // Si on n'a pas de données en mémoire, on regarde dans IndexedDB (c'est asynchrone maintenant)
  if (!effectiveHasData) {
    const cached = await loadCache(cacheKey); // <-- Le await est crucial ici
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
  await saveCache(cacheKey, data); // <-- Ajout du await ici
  if (typeof setOffline === 'function') setOffline(false);
  if (typeof onSuccess === 'function') onSuccess(data);
}
