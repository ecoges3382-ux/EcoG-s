// Lit TOUTES les lignes d'une requête, page par page.
//
// L'API Supabase plafonne chaque réponse (1 000 lignes par défaut) même si on demande davantage avec .limit(50000) :
// sans découpage, une école qui a plus de 1 000 notes n'en voit qu'une partie, sans aucune erreur. Ici on lit la première
// page avec le total, puis les pages suivantes en parallèle (quelques-unes à la fois).
//
// fetchPage(from, to, avecTotal) doit renvoyer la promesse d'une requête Supabase : le même filtre, un ordre STABLE
// (par exemple created_at puis id, sinon deux lignes à égalité peuvent être lues deux fois ou jamais) et .range(from, to).
// Quand avecTotal est vrai, la requête doit demander { count: 'exact' }.
//
// Renvoie { data, error }, comme une requête Supabase ; en cas d'erreur sur une page, rien n'est renvoyé de partiel.
export async function fetchAllRows(fetchPage, { pageSize = 1000, concurrency = 4, keyOf = (row) => row.id } = {}) {
  const first = await fetchPage(0, pageSize - 1, true);
  if (first.error) return { data: null, error: first.error };
  const firstRows = first.data || [];
  const total = typeof first.count === 'number' ? first.count : firstRows.length;
  if (firstRows.length >= total) return { data: firstRows, error: null };

  // Le serveur peut servir moins de lignes que demandé (plafond plus bas que prévu) : on suit ce qu'il a réellement servi.
  const step = firstRows.length;
  if (step === 0) return { data: firstRows, error: null };

  const starts = [];
  for (let s = step; s < total; s += step) starts.push(s);
  const pages = new Array(starts.length);
  let next = 0;
  let failure = null;

  async function worker() {
    while (!failure) {
      const i = next++;
      if (i >= starts.length) return;
      const r = await fetchPage(starts[i], starts[i] + step - 1, false);
      if (r.error) { failure = r.error; return; }
      pages[i] = r.data || [];
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, starts.length) }, worker));
  if (failure) return { data: null, error: failure };

  // Une ligne ajoutée ou supprimée pendant la lecture décale les pages : on retire les doublons éventuels.
  const seen = new Set();
  const rows = [];
  for (const row of firstRows.concat(...pages)) {
    const key = keyOf ? keyOf(row) : null;
    if (key != null) { if (seen.has(key)) continue; seen.add(key); }
    rows.push(row);
  }
  return { data: rows, error: null };
}
