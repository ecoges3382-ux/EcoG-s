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

// ---- lireTout : le raccourci utilisé par le tableau de bord, les rapports, le bilan, les absences… ----
import { lireTout, clePresence } from '../src/lib/fetchAll.js';

// Faux client Supabase : enregistre la requête construite (colonnes, filtres, ordre, pages) et sert les lignes d'une table.
function fauxSupabase(lignes, { plafond = 1000 } = {}) {
  const journal = [];
  const client = {
    from(table) {
      const req = { table, colonnes: null, options: null, filtres: [], ordres: [], plage: null };
      const q = {
        select(c, o) { req.colonnes = c; req.options = o; return q; },
        eq(k, v) { req.filtres.push(['eq', k, v]); return q; },
        gte(k, v) { req.filtres.push(['gte', k, v]); return q; },
        order(k, o) { req.ordres.push([k, o]); return q; },
        range(from, to) {
          req.plage = [from, to]; journal.push(req);
          const fin = Math.min(to, from + plafond - 1);
          return Promise.resolve({ data: lignes.slice(from, fin + 1), error: null, count: req.options && req.options.count ? lignes.length : null });
        },
      };
      return q;
    },
  };
  return { client, journal };
}

describe('lireTout (raccourci de lecture complète)', () => {
  it('construit la requête : colonnes, filtres, ordre demandé puis id, et la plage', async () => {
    const { client, journal } = fauxSupabase(lignes(10));
    await lireTout(client, 'payments', 'date, montant', (q) => q.eq('school_year_id', 'Y').gte('date', '2026-11-01'), { tri: [['date', { ascending: false }]] });
    expect(journal[0]).toMatchObject({
      table: 'payments', colonnes: 'date, montant', options: { count: 'exact' },
      filtres: [['eq', 'school_year_id', 'Y'], ['gte', 'date', '2026-11-01']],
      ordres: [['date', { ascending: false }], ['id', undefined]],
      plage: [0, 4999],
    });
  });

  it('lit tout, même si le serveur plafonne à 1 000 (6 pages pour 5 400 lignes)', async () => {
    const { client, journal } = fauxSupabase(lignes(5400), { plafond: 1000 });
    const { data, error } = await lireTout(client, 'attendance_records', 'student_id, date, statut', (q) => q.eq('school_year_id', 'Y'), { keyOf: null });
    expect(error).toBeNull();
    expect(data).toHaveLength(5400);
    expect(journal).toHaveLength(6);
  });

  it('plafond de 50 000 : une seule page suffit jusqu\'à 5 000 lignes, puis des pages de 5 000', async () => {
    const { client, journal } = fauxSupabase(lignes(12000), { plafond: 50000 });
    const { data } = await lireTout(client, 'attendance_records', 'x', (q) => q, { keyOf: null });
    expect(data).toHaveLength(12000);
    expect(journal.map((r) => r.plage)).toEqual([[0, 4999], [5000, 9999], [10000, 14999]]);
  });

  it('sans filtre ni tri : seulement l\'ordre par id', async () => {
    const { client, journal } = fauxSupabase(lignes(3));
    await lireTout(client, 'expenses', 'montant');
    expect(journal[0].ordres).toEqual([['id', undefined]]);
    expect(journal[0].filtres).toEqual([]);
  });

  it('la présence d\'un élève un jour donné a une clé unique (pas de doublon si une saisie arrive pendant la lecture)', () => {
    expect(clePresence({ student_id: 'e1', date: '2026-11-19' })).toBe('e1|2026-11-19');
    expect(clePresence({ statut: 'absent' })).toBeNull();
  });

  it('les doublons de présence sont écartés, et les lignes sans clé sont toutes gardées', async () => {
    const base = Array.from({ length: 2000 }, (_, i) => ({ student_id: 'e' + (i % 400), date: `2026-10-${String(1 + Math.floor(i / 400)).padStart(2, '0')}`, statut: 'present' }));
    let premier = true;
    const client = { from: () => { const q = { select: () => q, eq: () => q, order: () => q, range: (from, to) => { const r = { data: base.slice(from, to + 1), error: null, count: base.length }; if (premier) { premier = false; base.unshift({ ...base[0] }); } return Promise.resolve(r); } }; return q; } };
    const { data } = await lireTout(client, 'attendance_records', 'x', (q) => q, { keyOf: clePresence, pageSize: 1000 });
    expect(new Set(data.map(clePresence)).size).toBe(data.length);
    const sansCle = await lireTout(fauxSupabase(lignes(2500)).client, 't', 'x', (q) => q, { keyOf: null, pageSize: 1000 });
    expect(sansCle.data).toHaveLength(2500);
  });
});
