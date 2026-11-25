// Tests du calcul des échéances et des relances (src/lib/retard.js).
// C'est la partie la plus sensible de l'application : elle décide qui doit quoi, et qui reçoit une relance.
// Les résultats attendus sont calculés à la main à partir des règles de gestion, pas copiés du code.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { computeEcheances, computeRelance, resumeMoratoire, MORATOIRE_ALERTE_JOURS, statutRecouvrement, calendrierConfigure } from '../src/lib/retard.js';

// « Aujourd'hui » est figé : sinon les tests changeraient de résultat selon le jour où on les lance.
const AUJOURDHUI = '2026-11-18T12:00:00Z';
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(AUJOURDHUI)); });
afterAll(() => { vi.useRealTimers(); });

const PASSE = '2026-10-01';   // date limite dépassée
const FUTUR = '2027-02-01';   // date limite pas encore atteinte
const grille = (a, b, c) => ({ montant_tranche1: a, montant_tranche2: b, montant_tranche3: c });
const annee = (t1, t2, t3, connexe = null) => ({ date_tranche1: t1, date_tranche2: t2, date_tranche3: t3, date_connexe: connexe });
const inscr = (du, paye, extra = {}) => ({ montant_du: du, montant_paye: paye, frais_connexe_du: 0, frais_connexe_paye: 0, ...extra });

describe('découpage de la scolarité en tranches', () => {
  it('répartit selon les proportions de la grille tarifaire', () => {
    const e = computeEcheances(inscr(300000, 0), annee(PASSE, PASSE, PASSE), grille(150000, 100000, 50000));
    expect(e.map((x) => x.montant)).toEqual([150000, 100000, 50000]);
  });

  it('adapte le montant à ce que l\'élève doit vraiment (réduction, bourse)', () => {
    const e = computeEcheances(inscr(150000, 0), annee(PASSE, PASSE, PASSE), grille(150000, 100000, 50000));
    expect(e.map((x) => x.montant)).toEqual([75000, 50000, 25000]);
  });

  it('ne perd jamais un franc : l\'arrondi est reporté sur la dernière tranche', () => {
    // 100 000 réparti en trois parts égales : 33 333 + 33 333 + 33 334
    const e = computeEcheances(inscr(100000, 0), annee(PASSE, PASSE, PASSE), grille(100, 100, 100));
    expect(e.map((x) => x.montant)).toEqual([33333, 33333, 33334]);
    expect(e.reduce((s, x) => s + x.montant, 0)).toBe(100000);
  });

  it('ignore une tranche à zéro dans la grille et garde le bon numéro de tranche', () => {
    const e = computeEcheances(inscr(90000, 0), annee(PASSE, PASSE, PASSE), grille(200, 0, 100));
    expect(e.map((x) => [x.id, x.montant])).toEqual([['tranche1', 60000], ['tranche3', 30000]]);
    expect(e.map((x) => x.ordre)).toEqual([1, 2]);
  });

  it('sans grille : autant de parts égales que de dates configurées', () => {
    const e = computeEcheances(inscr(90000, 0), annee(PASSE, PASSE, PASSE), null);
    expect(e.map((x) => x.montant)).toEqual([30000, 30000, 30000]);
  });

  it('sans grille et sans date : une seule échéance pour tout le montant', () => {
    const e = computeEcheances(inscr(90000, 0), annee(null, null, null), null);
    expect(e).toHaveLength(1);
    expect(e[0].montant).toBe(90000);
    expect(e[0].dateLimite).toBeNull();
  });

  it('sans grille : le reste de l\'arrondi va aussi à la dernière part', () => {
    const e = computeEcheances(inscr(100000, 0), annee(PASSE, PASSE, PASSE), null);
    expect(e.map((x) => x.montant)).toEqual([33333, 33333, 33334]);
  });

  it('accepte des montants reçus sous forme de texte', () => {
    const e = computeEcheances(inscr('300000', '150000'), annee(PASSE, PASSE, PASSE), grille('150000', '100000', '50000'));
    expect(e.map((x) => x.montantPaye)).toEqual([150000, 0, 0]);
  });
});

describe('ce qui est payé couvre les tranches dans l\'ordre', () => {
  it('une tranche soldée, une partielle, une impayée', () => {
    const e = computeEcheances(inscr(300000, 200000), annee(PASSE, PASSE, FUTUR), grille(150000, 100000, 50000));
    expect(e[0]).toMatchObject({ montantPaye: 150000, montantRestant: 0, statut: 'payee' });
    expect(e[1]).toMatchObject({ montantPaye: 50000, montantRestant: 50000, statut: 'partielle' });
    expect(e[2]).toMatchObject({ montantPaye: 0, montantRestant: 50000, statut: 'a_venir' });
  });

  it('un trop-perçu ne dépasse jamais le montant d\'une tranche', () => {
    const e = computeEcheances(inscr(300000, 999999), annee(PASSE, PASSE, PASSE), grille(150000, 100000, 50000));
    expect(e.every((x) => x.statut === 'payee' && x.montantRestant === 0)).toBe(true);
    expect(e.map((x) => x.montantPaye)).toEqual([150000, 100000, 50000]);
  });

  it('un montant négatif enregistré par erreur ne crée pas de dette inventée', () => {
    const e = computeEcheances(inscr(300000, -5000), annee(PASSE, PASSE, PASSE), grille(150000, 100000, 50000));
    expect(e.map((x) => x.montantPaye)).toEqual([0, 0, 0]);
  });

  it('une inscription gratuite (montant 0) est considérée payée', () => {
    const e = computeEcheances(inscr(0, 0), annee(PASSE, PASSE, PASSE), grille(150000, 100000, 50000));
    expect(e.every((x) => x.statut === 'payee')).toBe(true);
  });
});

describe('statut et retard selon la date limite', () => {
  it('impayée et date dépassée : en retard', () => {
    const [t] = computeEcheances(inscr(100000, 0), annee(PASSE, null, null), grille(100, 0, 0));
    expect(t).toMatchObject({ statut: 'impayee', enRetard: true });
  });

  it('impayée mais date à venir : « à venir », pas en retard', () => {
    const [t] = computeEcheances(inscr(100000, 0), annee(FUTUR, null, null), grille(100, 0, 0));
    expect(t).toMatchObject({ statut: 'a_venir', enRetard: false });
  });

  it('partiellement payée et date dépassée : en retard', () => {
    const [t] = computeEcheances(inscr(100000, 40000), annee(PASSE, null, null), grille(100, 0, 0));
    expect(t).toMatchObject({ statut: 'partielle', enRetard: true });
  });

  it('partiellement payée et date à venir : partielle, pas en retard', () => {
    const [t] = computeEcheances(inscr(100000, 40000), annee(FUTUR, null, null), grille(100, 0, 0));
    expect(t).toMatchObject({ statut: 'partielle', enRetard: false });
  });

  it('soldée : jamais en retard, même si la date est dépassée', () => {
    const [t] = computeEcheances(inscr(100000, 100000), annee(PASSE, null, null), grille(100, 0, 0));
    expect(t).toMatchObject({ statut: 'payee', enRetard: false });
  });

  it('sans date limite : impayée mais jamais « en retard » (rien à dépasser)', () => {
    const [t] = computeEcheances(inscr(100000, 0), annee(null, null, null), grille(100, 0, 0));
    expect(t).toMatchObject({ statut: 'impayee', enRetard: false });
  });
});

describe('frais connexes', () => {
  it('apparaissent après la scolarité, avec leur propre date', () => {
    const e = computeEcheances(inscr(100000, 100000, { frais_connexe_du: 20000, frais_connexe_paye: 5000 }), annee(PASSE, null, null, PASSE), grille(100, 0, 0));
    const c = e[e.length - 1];
    expect(c).toMatchObject({ id: 'connexe', label: 'Frais connexes', montant: 20000, montantPaye: 5000, montantRestant: 15000, statut: 'partielle', enRetard: true });
    expect(c.ordre).toBe(e.length);
  });

  it('absents quand il n\'y a ni date ni montant', () => {
    const e = computeEcheances(inscr(100000, 0), annee(PASSE, null, null, null), grille(100, 0, 0));
    expect(e.some((x) => x.id === 'connexe')).toBe(false);
  });

  it('présents s\'il y a un montant, même sans date', () => {
    const e = computeEcheances(inscr(100000, 0, { frais_connexe_du: 8000 }), annee(PASSE, null, null, null), grille(100, 0, 0));
    expect(e.find((x) => x.id === 'connexe')).toMatchObject({ montant: 8000, dateLimite: null, enRetard: false });
  });

  it('un montant payé supérieur au dû est plafonné', () => {
    const e = computeEcheances(inscr(100000, 100000, { frais_connexe_du: 8000, frais_connexe_paye: 9999 }), annee(PASSE, null, null, PASSE), grille(100, 0, 0));
    expect(e.find((x) => x.id === 'connexe')).toMatchObject({ montantPaye: 8000, montantRestant: 0, statut: 'payee' });
  });

  it('à venir tant que la date n\'est pas atteinte', () => {
    const e = computeEcheances(inscr(100000, 100000, { frais_connexe_du: 8000 }), annee(PASSE, null, null, FUTUR), grille(100, 0, 0));
    expect(e.find((x) => x.id === 'connexe')).toMatchObject({ statut: 'a_venir', enRetard: false });
  });
});

describe('entrées absentes', () => {
  it('sans année scolaire ou sans inscription : aucune échéance', () => {
    expect(computeEcheances(inscr(1, 0), null, null)).toEqual([]);
    expect(computeEcheances(null, annee(PASSE, null, null), null)).toEqual([]);
  });
});

// Vérifie des propriétés qui doivent toujours être vraies, sur des centaines de cas tirés au hasard (graine fixe :
// le test donne toujours le même résultat, mais un cas oublié à la main a plus de chances d'être couvert).
describe('propriétés qui doivent toujours être vraies', () => {
  function alea(graine) { let s = graine; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

  it('sur 600 cas aléatoires : somme des tranches = montant dû, payé + reste = montant, jamais de négatif', () => {
    const r = alea(42);
    const entier = (max) => Math.floor(r() * max);
    for (let i = 0; i < 600; i++) {
      const du = entier(2_000_000);
      const paye = entier(2_500_000);
      const g = r() < 0.2 ? null : grille(entier(300_000), entier(300_000), entier(300_000));
      const dates = [r() < 0.5 ? PASSE : (r() < 0.5 ? FUTUR : null), r() < 0.5 ? PASSE : (r() < 0.5 ? FUTUR : null), r() < 0.5 ? PASSE : (r() < 0.5 ? FUTUR : null)];
      const e = computeEcheances(inscr(du, paye), annee(...dates), g).filter((x) => x.id !== 'connexe');
      const somme = e.reduce((s, x) => s + x.montant, 0);
      expect(somme, `cas ${i} : du=${du} grille=${JSON.stringify(g)}`).toBe(du);
      expect(e.reduce((s, x) => s + x.montantPaye, 0), `cas ${i} : payé`).toBe(Math.min(paye, du));
      for (const x of e) {
        expect(x.montantPaye + x.montantRestant).toBe(x.montant);
        expect(x.montant).toBeGreaterThanOrEqual(0);
        expect(x.montantPaye).toBeGreaterThanOrEqual(0);
        expect(x.montantRestant).toBeGreaterThanOrEqual(0);
        if (x.statut === 'payee') expect(x.montantRestant).toBe(0);
        if (x.enRetard) expect(x.dateLimite).not.toBeNull();
      }
    }
  });
});

describe('qui reçoit une relance (computeRelance)', () => {
  const retard = annee(PASSE, PASSE, PASSE);
  const g = grille(150000, 100000, 50000);

  it('personne sans inscription', () => {
    expect(computeRelance(null, retard, g)).toMatchObject({ relance: false, moratoire: false });
  });

  it('un élève en retard sur la scolarité est à relancer', () => {
    expect(computeRelance(inscr(300000, 0), retard, g)).toMatchObject({ relance: true, relanceEcolage: true, relanceConnexe: false });
  });

  it('un élève en retard seulement sur les frais connexes', () => {
    const r = computeRelance(inscr(300000, 300000, { frais_connexe_du: 10000 }), annee(PASSE, PASSE, PASSE, PASSE), g);
    expect(r).toMatchObject({ relance: true, relanceEcolage: false, relanceConnexe: true });
  });

  it('un élève à jour n\'est pas relancé', () => {
    expect(computeRelance(inscr(300000, 300000), retard, g).relance).toBe(false);
  });

  it('pas de relance tant que les dates limites ne sont pas dépassées', () => {
    expect(computeRelance(inscr(300000, 0), annee(FUTUR, FUTUR, FUTUR), g).relance).toBe(false);
  });

  it('sans année scolaire : pas de relance', () => {
    expect(computeRelance(inscr(300000, 0), null, g).relance).toBe(false);
  });

  describe('moratoire (arrangement avec la famille)', () => {
    it('moratoire actif : on ne relance pas', () => {
      expect(computeRelance(inscr(300000, 0, { moratoire_actif: true }), retard, g)).toMatchObject({ relance: false, moratoire: true });
    });

    it('une note d\'arrangement vaut moratoire', () => {
      expect(computeRelance(inscr(300000, 0, { note_arrangement: 'paie par mensualités' }), retard, g)).toMatchObject({ relance: false, moratoire: true });
    });

    it('une note vide ou faite d\'espaces n\'est pas un moratoire', () => {
      expect(computeRelance(inscr(300000, 0, { note_arrangement: '   ' }), retard, g)).toMatchObject({ relance: true, moratoire: false });
    });

    it('moratoire dont tout est finalement payé : il est retiré automatiquement', () => {
      expect(computeRelance(inscr(300000, 300000, { moratoire_actif: true }), retard, g)).toMatchObject({ moratoireRetireAuto: true, relance: false, moratoire: false });
    });

    it('moratoire qui expire dans moins de 7 jours : la relance reprend', () => {
      const bientot = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const r = computeRelance(inscr(300000, 0, { moratoire_actif: true, moratoire_date_fin: bientot }), retard, g);
      expect(r).toMatchObject({ moratoireExpirant: true, relance: true, moratoire: false });
    });

    it('moratoire qui court encore longtemps : on ne relance pas', () => {
      const loin = new Date(Date.now() + (MORATOIRE_ALERTE_JOURS + 30) * 86400000).toISOString().slice(0, 10);
      const r = computeRelance(inscr(300000, 0, { moratoire_actif: true, moratoire_date_fin: loin }), retard, g);
      expect(r).toMatchObject({ relance: false, moratoire: true });
    });
  });
});

describe('résumé du moratoire', () => {
  it('« Aucun moratoire » quand il n\'y en a pas', () => {
    expect(resumeMoratoire(null)).toBe('Aucun moratoire');
    expect(resumeMoratoire(inscr(1, 0))).toBe('Aucun moratoire');
  });

  it('actif mais sans détail', () => {
    expect(resumeMoratoire(inscr(1, 0, { moratoire_actif: true }))).toBe('Moratoire actif');
  });

  it('assemble les informations connues', () => {
    const t = resumeMoratoire(inscr(1, 0, { moratoire_actif: true, moratoire_motif: 'Perte d\'emploi', moratoire_nb_mensualites: 3, note_arrangement: 'accord oral' }));
    expect(t).toContain('Motif : Perte d\'emploi');
    expect(t).toContain('3 mensualité(s)');
    expect(t).toContain('Note : accord oral');
  });
});

describe('statut de recouvrement (définition commune au Tableau de bord et à la page Recouvrement)', () => {
  const g = grille(100000, 100000, 100000);

  it('élève qui a tout payé : à jour, même si la date limite est dépassée', () => {
    const r = statutRecouvrement(inscr(300000, 300000), annee(PASSE, PASSE, PASSE), g);
    expect(r.statutKey).toBe('a_jour');
    expect(r.resteEcolage).toBe(0);
  });

  it('calendrier renseigné, date limite dépassée, solde restant : à relancer', () => {
    const r = statutRecouvrement(inscr(300000, 50000), annee(PASSE, PASSE, PASSE), g);
    expect(r.statutKey).toBe('a_relancer');
    expect(r.resteEcolage).toBe(250000);
  });

  it('calendrier renseigné, date limite pas encore atteinte : dans les délais, pas à relancer', () => {
    const r = statutRecouvrement(inscr(300000, 0), annee(FUTUR, FUTUR, FUTUR), g);
    expect(r.statutKey).toBe('dans_les_delais');
  });

  it('sans calendrier : solde restant, jamais « à relancer »', () => {
    const r = statutRecouvrement(inscr(300000, 0), annee(null, null, null), g);
    expect(r.statutKey).toBe('solde_restant');
  });

  it('un frais connexe en retard suffit pour être à relancer', () => {
    const r = statutRecouvrement(inscr(300000, 300000, { frais_connexe_du: 20000, frais_connexe_paye: 0 }), annee(FUTUR, FUTUR, FUTUR, PASSE), g);
    expect(r.statutKey).toBe('a_relancer');
    expect(r.resteConnexe).toBe(20000);
  });

  it('le calendrier compte aussi la date des frais connexes', () => {
    expect(calendrierConfigure(annee(null, null, null))).toBe(false);
    expect(calendrierConfigure(annee(null, null, null, PASSE))).toBe(true);
    expect(calendrierConfigure(null)).toBe(false);
  });
});
