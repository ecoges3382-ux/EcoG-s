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

// Enrobe un seul appel Supabase avec le repli hors-ligne : si rien n'est
// encore affiché, hydrate depuis le cache pendant que la requête part ;
// si la requête échoue, garde ce qui est déjà affiché (en direct ou
// depuis le cache) plutôt que de basculer sur une erreur ou un écran
// vide — l'erreur "dure" (onError) ne sert que quand il n'y a vraiment
// rien à montrer. `hasData` doit refléter l'état affiché AU MOMENT de
// l'appel (ex. `students !== null`), pas relu après coup : un setState
// ne met pas à jour la variable déjà capturée dans cette même fonction.
export async function guardedFetch({ cacheKey, hasData, load, setData, setOffline, onError, onSuccess, isCancelled }) {
  let effectiveHasData = hasData;
  if (!effectiveHasData) {
    const cached = loadCache(cacheKey);
    if (cached) {
      setData(cached.data);
      setOffline(true);
      effectiveHasData = true;
    }
  }
  const { data, error } = await load();
  if (isCancelled?.()) return;
  if (error) {
    if (effectiveHasData) { setOffline(true); return; }
    onError?.(error);
    return;
  }
  setData(data);
  saveCache(cacheKey, data);
  setOffline(false);
  onSuccess?.(data);
}
