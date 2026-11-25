// Lecture des montants d'inscription : la vue « enrollments_argent » pour ceux qui ont accès aux finances, rien pour les autres,
// et l'ancien emplacement tant que le script SQL n'a pas été lancé.
import { describe, it, expect } from 'vitest';
import { lireInscriptions, ARGENT_VIDE, COLONNES_ARGENT, suffixeCacheArgent } from '../src/lib/argentInscriptions.js';

// Faux client Supabase : `tables` = { nom: { rows } | { error } }. Garde la trace des tables et colonnes demandées.
function faux(tables) {
  const appels = [];
  return {
    appels,
    from(table) {
      const config = tables[table];
      const requete = {
        select(colonnes) { appels.push({ table, colonnes }); return requete; },
        eq() { return requete; },
        order() { return requete; },
        range() {
          if (!config || config.error) return Promise.resolve({ data: null, error: config?.error || { code: '42P01', message: `relation "${table}" does not exist` }, count: null });
          return Promise.resolve({ data: config.rows, error: null, count: config.rows.length });
        },
      };
      return requete;
    },
  };
}

const colonnes = 'statut, classe_id';
const ordinaires = [{ id: 'e1', statut: 'inscrit', classe_id: 'c1' }, { id: 'e2', statut: 'inscrit', classe_id: 'c1' }];
const argent = [
  { id: 'e1', montant_du: 150000, montant_paye: 50000, frais_connexe_du: 20000, frais_connexe_paye: 0, note_arrangement: null, moratoire_montant_convenu: null },
  { id: 'e2', montant_du: 150000, montant_paye: 150000, frais_connexe_du: 20000, frais_connexe_paye: 20000, note_arrangement: 'ok', moratoire_montant_convenu: null },
];

describe('lireInscriptions', () => {
  it('avec accès aux finances : les montants viennent de la vue et sont rattachés à la bonne inscription', async () => {
    const client = faux({ enrollments: { rows: ordinaires }, enrollments_argent: { rows: argent } });
    const { data, error } = await lireInscriptions(client, { colonnes, finance: true });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ id: 'e1', statut: 'inscrit', montant_du: 150000, montant_paye: 50000 });
    expect(data[1]).toMatchObject({ id: 'e2', montant_paye: 150000, note_arrangement: 'ok' });
  });

  it('sans accès aux finances : on ne demande même pas les montants, ils valent 0', async () => {
    const client = faux({ enrollments: { rows: ordinaires }, enrollments_argent: { rows: argent } });
    const { data } = await lireInscriptions(client, { colonnes, finance: false });
    expect(client.appels.map((a) => a.table)).toEqual(['enrollments']);
    expect(client.appels[0].colonnes).not.toMatch(/montant_du|montant_paye|frais_connexe|note_arrangement/);
    expect(data[0]).toMatchObject({ id: 'e1', statut: 'inscrit', ...ARGENT_VIDE });
  });

  it('la lecture des colonnes ordinaires ne demande jamais de montant', async () => {
    const client = faux({ enrollments: { rows: ordinaires }, enrollments_argent: { rows: argent } });
    await lireInscriptions(client, { colonnes, finance: true });
    const lecture = client.appels.find((a) => a.table === 'enrollments' && a.colonnes.includes('statut'));
    expect(lecture.colonnes).not.toMatch(/montant_du|montant_paye/);
  });

  it('avant le script SQL (vue absente) : les montants sont lus à l’ancien endroit', async () => {
    const client = faux({ enrollments: { rows: ordinaires.map((o, i) => ({ ...o, ...argent[i] })) } });
    const { data, error } = await lireInscriptions(client, { colonnes, finance: true });
    expect(error).toBeNull();
    expect(client.appels.map((a) => a.table)).toEqual(['enrollments', 'enrollments_argent', 'enrollments']);
    expect(data[0].montant_paye).toBe(50000);
  });

  it('une vraie erreur de lecture des montants est renvoyée (pas de zéros trompeurs pour un fondateur)', async () => {
    const client = faux({ enrollments: { rows: ordinaires }, enrollments_argent: { error: { code: '57014', message: 'timeout' } } });
    const { data, error } = await lireInscriptions(client, { colonnes, finance: true });
    expect(data).toBeNull();
    expect(error.code).toBe('57014');
  });

  it('une erreur sur les colonnes ordinaires est renvoyée aussi', async () => {
    const client = faux({ enrollments: { error: { code: '500', message: 'boom' } }, enrollments_argent: { rows: argent } });
    const { error } = await lireInscriptions(client, { colonnes, finance: true });
    expect(error.message).toBe('boom');
  });

  it('une inscription absente de la vue garde des montants à 0', async () => {
    const client = faux({ enrollments: { rows: ordinaires }, enrollments_argent: { rows: [argent[0]] } });
    const { data } = await lireInscriptions(client, { colonnes, finance: true });
    expect(data[1]).toMatchObject({ id: 'e2', montant_du: 0, montant_paye: 0 });
  });
});

describe('cache hors ligne', () => {
  it('la version sans montants a sa propre clé : un appareil partagé ne ressert pas les montants d’une secrétaire à un enseignant', () => {
    expect(suffixeCacheArgent(true)).toBe('');
    expect(suffixeCacheArgent(false)).not.toBe('');
  });
});

it('la liste des colonnes d’argent est celle de la base', () => {
  expect(COLONNES_ARGENT.split(',').map((c) => c.trim()).sort()).toEqual(['frais_connexe_du', 'frais_connexe_paye', 'montant_du', 'montant_paye', 'moratoire_montant_convenu', 'note_arrangement']);
});
