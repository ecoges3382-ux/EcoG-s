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

it('la liste des colonnes d’argent est celle de la base (montants + moratoire)', () => {
  expect(COLONNES_ARGENT.split(',').map((c) => c.trim()).sort()).toEqual([
    'frais_connexe_du', 'frais_connexe_paye', 'montant_du', 'montant_paye', 'moratoire_actif', 'moratoire_date_debut', 'moratoire_date_fin',
    'moratoire_montant_convenu', 'moratoire_motif', 'moratoire_nb_mensualites', 'moratoire_prochaine_echeance', 'note_arrangement',
  ]);
  expect(Object.keys(ARGENT_VIDE).sort()).toEqual(COLONNES_ARGENT.split(',').map((c) => c.trim()).sort());
});

describe('vue de la première version (sans le moratoire)', () => {
  // Faux client qui se comporte comme la base après la 1re version du script : la vue n'a pas les colonnes du moratoire (erreur 42703),
  // mais la table les laisse encore lire.
  function premiereVersion() {
    const appels = [];
    return {
      appels,
      from(table) {
        const requete = {
          select(colonnes) { appels.push({ table, colonnes }); requete.colonnes = colonnes; return requete; },
          eq() { return requete; }, order() { return requete; },
          range() {
            const c = requete.colonnes || '';
            if (table === 'enrollments_argent' && /moratoire_actif/.test(c)) return Promise.resolve({ data: null, error: { code: '42703', message: 'column enrollments_argent.moratoire_actif does not exist' }, count: null });
            if (table === 'enrollments_argent') return Promise.resolve({ data: argent.map((a) => ({ id: a.id, montant_du: a.montant_du, montant_paye: a.montant_paye, frais_connexe_du: a.frais_connexe_du, frais_connexe_paye: a.frais_connexe_paye, note_arrangement: a.note_arrangement, moratoire_montant_convenu: null })), error: null, count: 2 });
            if (/moratoire_actif/.test(c)) return Promise.resolve({ data: [{ id: 'e1', moratoire_actif: true, moratoire_nb_mensualites: 3, moratoire_date_debut: null, moratoire_date_fin: '2026-12-01', moratoire_motif: 'Maladie', moratoire_prochaine_echeance: null }, { id: 'e2', moratoire_actif: false, moratoire_nb_mensualites: null, moratoire_date_debut: null, moratoire_date_fin: null, moratoire_motif: null, moratoire_prochaine_echeance: null }], error: null, count: 2 });
            return Promise.resolve({ data: ordinaires, error: null, count: 2 });
          },
        };
        return requete;
      },
    };
  }

  it('les montants viennent de la vue, le moratoire de la table : l’écran marche pendant la mise à jour', async () => {
    const client = premiereVersion();
    const { data, error } = await lireInscriptions(client, { colonnes, finance: true });
    expect(error).toBeNull();
    expect(data[0]).toMatchObject({ id: 'e1', montant_du: 150000, montant_paye: 50000, moratoire_actif: true, moratoire_nb_mensualites: 3, moratoire_motif: 'Maladie', moratoire_date_fin: '2026-12-01' });
    expect(data[1]).toMatchObject({ id: 'e2', montant_paye: 150000, moratoire_actif: false });
  });
});

describe('colonnes ordinaires', () => {
  it('ne contiennent aucune colonne protégée (sinon la lecture échouerait pour un enseignant)', async () => {
    const fichiers = ['src/lib/enrollments.js', 'src/pages/Students.jsx', 'src/pages/StudentDetail.jsx'];
    const fs = await import('node:fs');
    const path = await import('node:path');
    const protegees = /\b(montant_du|montant_paye|frais_connexe_du|frais_connexe_paye|note_arrangement|moratoire_[a-z_]+)\b/;
    for (const f of fichiers) {
      const texte = fs.readFileSync(path.join(import.meta.dirname, '..', f), 'utf8');
      const lectures = [...texte.matchAll(/colonnes:\s*'([^']*)'/g)].map((m) => m[1]);
      expect(lectures.length, f).toBeGreaterThan(0);
      for (const l of lectures) expect(l, f).not.toMatch(protegees);
    }
  });
});
