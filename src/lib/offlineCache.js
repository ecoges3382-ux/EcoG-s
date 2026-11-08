// Petit cache local en lecture seule : garde la dernière version connue
// d'un écran (liste des élèves, fiche élève) pour que l'affichage ne
// devienne jamais vide ou en erreur si la connexion coupe un instant —
// jamais utilisé pour enregistrer quoi que ce soit hors connexion,
// seulement pour réafficher la dernière donnée reçue en attendant que
// la connexion revienne.
const PREFIX = 'ecoges_cache_';

export function saveCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Stockage plein ou indisponible (navigation privée, quota atteint) :
    // pas grave, l'app continue de fonctionner normalement en ligne.
  }
}

export function loadCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Enrobe un seul appel Supabase avec le repli hors-ligne.
export async function guardedFetch({ cacheKey, hasData, load, setData, setOffline, onError, onSuccess, isCancelled }) {
  let effectiveHasData = hasData;
  
  if (!effectiveHasData) {
    const cached = loadCache(cacheKey);
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
  saveCache(cacheKey, data);
  if (typeof setOffline === 'function') setOffline(false);
  if (typeof onSuccess === 'function') onSuccess(data);
}
