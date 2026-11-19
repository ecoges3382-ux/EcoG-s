// Lecture de toutes les lignes d'une table, page par page : le serveur plafonne chaque réponse (1 000 par défaut).
import { describe, it, expect } from 'vitest';
import { fetchAllRows } from '../src/lib/fetchAll.js';

// Faux serveur : renvoie au plus `plafond` lignes par réponse, comme l'API Supabase, avec le total demandé.
function serveur(lignes, { plafond = 1000, panneSurDebut = null, retardAleatoire = false } = {}) {
  const appels = [];
  const fetchPage = async (from, to, avecTotal) => {
    appels.push({ from, to, avecTotal });
    if (retardAleatoire) await new Promise((r) => setTimeout(r, Math.random() * 5));
    if (panneSurDebut !== null && from === panneSurDebut) return { data: null, error: { message: 'réseau coupé' } };
    const fin = Math.min(to, from + plafond - 1);
    return { data: lignes.slice(from, fin + 1), error: null, count: avecTotal ? lignes.length : null };
  };
  return { fetchPage, appels };
}
const lignes = (n) => Array.from({ length: n }, (_, i) => ({ id: 'g' + i, i }));

describe('lecture page par page', () => {
  it('renvoie tout, dans l\'ordre, au-delà du plafond de 1 000 lignes', async () => {
    const { fetchPage } = serveur(lignes(2500));
    const { data, error } = await fetchAllRows(fetchPage);
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data.map((l) => l.i)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
  });

  it('30 000 notes : 30 pages, la première avec le total, les autres sans', async () => {
    const { fetchPage, appels } = serveur(lignes(30000));
    const { data } = await fetchAllRows(fetchPage);
    expect(data).toHaveLength(30000);
    expect(appels).toHaveLength(30);
    expect(appels.filter((a) => a.avecTotal)).toHaveLength(1);
    expect(appels[0]).toMatchObject({ from: 0, to: 999, avecTotal: true });
  });

  it('une seule page suffit : un seul appel', async () => {
    const { fetchPage, appels } = serveur(lignes(300));
    expect((await fetchAllRows(fetchPage)).data).toHaveLength(300);
    expect(appels).toHaveLength(1);
  });

  it('pile 1 000 lignes : pas de page vide en trop', async () => {
    const { fetchPage, appels } = serveur(lignes(1000));
    expect((await fetchAllRows(fetchPage)).data).toHaveLength(1000);
    expect(appels).toHaveLength(1);
  });

  it('aucune ligne : liste vide, sans erreur', async () => {
    const { fetchPage } = serveur([]);
    expect(await fetchAllRows(fetchPage)).toEqual({ data: [], error: null });
  });

  it('suit le plafond réel du serveur quand il est plus bas que la page demandée', async () => {
    const { fetchPage } = serveur(lignes(2300), { plafond: 500 });
    const { data } = await fetchAllRows(fetchPage, { pageSize: 1000 });
    expect(data).toHaveLength(2300);
    expect(new Set(data.map((l) => l.id)).size).toBe(2300);
  });

  it('une page qui échoue : on renvoie l\'erreur, jamais un résultat incomplet', async () => {
    const { fetchPage } = serveur(lignes(5000), { panneSurDebut: 3000 });
    const r = await fetchAllRows(fetchPage);
    expect(r.data).toBeNull();
    expect(r.error.message).toBe('réseau coupé');
  });

  it('une erreur sur la première page est renvoyée telle quelle', async () => {
    const r = await fetchAllRows(async () => ({ data: null, error: { message: 'non autorisé' } }));
    expect(r).toEqual({ data: null, error: { message: 'non autorisé' } });
  });

  it('les pages arrivant dans le désordre sont remises dans l\'ordre', async () => {
    const { fetchPage } = serveur(lignes(7000), { retardAleatoire: true });
    const { data } = await fetchAllRows(fetchPage, { concurrency: 6 });
    expect(data.map((l) => l.i)).toEqual(Array.from({ length: 7000 }, (_, i) => i));
  });

  it('une ligne ajoutée pendant la lecture ne crée pas de doublon', async () => {
    const base = lignes(2000);
    let premier = true;
    const fetchPage = async (from, to, avecTotal) => {
      const r = { data: base.slice(from, to + 1), error: null, count: avecTotal ? base.length : null };
      if (premier) { premier = false; base.unshift({ id: 'nouvelle', i: -1 }); } // décale les pages suivantes d'un cran
      return r;
    };
    const { data } = await fetchAllRows(fetchPage);
    const ids = data.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
