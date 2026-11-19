// Formulaires d'encaissement : quelles tranches proposer selon le type de frais, et le détail de ce qui est déjà payé.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { tranchesPourType, trancheValidePourType, trancheApresChangementDeType, detailEncaissements } from '../src/lib/paymentForm.js';

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-19T08:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

const ids = (liste) => liste.map((t) => t.id);

describe('tranches proposées selon le type de frais', () => {
  it('écolage : 1ère, 2ème, 3ème tranche, moitié, complet, autre', () => {
    expect(ids(tranchesPourType('scolarite'))).toEqual(['tranche1', 'tranche2', 'tranche3', 'moitie', 'complet', 'autre']);
  });

  it('frais connexes, inscription et autres frais : seulement Complet et Autre', () => {
    for (const type of ['connexe', 'inscription', 'autre']) expect(ids(tranchesPourType(type)), type).toEqual(['complet', 'autre']);
  });

  it('une tranche d\'écolage n\'est pas valable pour les autres types', () => {
    for (const t of ['tranche1', 'tranche2', 'tranche3', 'moitie']) {
      expect(trancheValidePourType('scolarite', t), `scolarite/${t}`).toBe(true);
      expect(trancheValidePourType('connexe', t), `connexe/${t}`).toBe(false);
      expect(trancheValidePourType('inscription', t), `inscription/${t}`).toBe(false);
    }
    expect(trancheValidePourType('connexe', 'complet')).toBe(true);
    expect(trancheValidePourType('inscription', 'autre')).toBe(true);
  });
});

describe('changement de type de frais', () => {
  it('une tranche devenue interdite revient à « Complet »', () => {
    expect(trancheApresChangementDeType('connexe', 'tranche2')).toBe('complet');
    expect(trancheApresChangementDeType('inscription', 'moitie')).toBe('complet');
    expect(trancheApresChangementDeType('autre', 'tranche1')).toBe('complet');
  });

  it('une tranche encore permise est conservée', () => {
    expect(trancheApresChangementDeType('connexe', 'autre')).toBe('autre');
    expect(trancheApresChangementDeType('connexe', 'complet')).toBe('complet');
    expect(trancheApresChangementDeType('scolarite', 'tranche3')).toBe('tranche3');
  });

  it('de retour sur l\'écolage, « Complet » reste choisi (rien d\'imprévu)', () => {
    expect(trancheApresChangementDeType('scolarite', 'complet')).toBe('complet');
  });
});

describe('détail de ce qui est déjà payé', () => {
  const annee = { date_tranche1: '2026-10-01', date_tranche2: '2027-01-15', date_tranche3: '2027-04-01', date_connexe: '2026-09-15' };
  const grille = { montant_tranche1: 50000, montant_tranche2: 50000, montant_tranche3: 50000 };
  const eleve = (paye, extra = {}) => ({ montant_du: 150000, montant_paye: paye, frais_connexe_du: 25000, frais_connexe_paye: 0, ...extra });
  const parId = (d) => Object.fromEntries(d.echeances.map((e) => [e.id, e]));

  it('le cas de la capture : 73 000 payés sur 150 000 = 1ère tranche payée, 2ème payée à 23 000 sur 50 000, 3ème intacte (pas encore due)', () => {
    const d = detailEncaissements(eleve(73000), annee, grille);
    const e = parId(d);
    expect(e.tranche1).toMatchObject({ statut: 'payee', montantPaye: 50000, montantRestant: 0 });
    expect(e.tranche2).toMatchObject({ statut: 'partielle', montantPaye: 23000, montantRestant: 27000 });
    expect(e.tranche3).toMatchObject({ statut: 'a_venir', montantPaye: 0, montantRestant: 50000 }); // échéance en avril 2027 : pas encore due
    expect(e.connexe).toMatchObject({ statut: 'impayee', montant: 25000 });
  });

  it('indique la tranche à payer en premier : la première qui n\'est pas soldée', () => {
    expect(detailEncaissements(eleve(73000), annee, grille).prochaine).toBe('tranche2');
    expect(detailEncaissements(eleve(0), annee, grille).prochaine).toBe('tranche1');
    expect(detailEncaissements(eleve(50000), annee, grille).prochaine).toBe('tranche2');
  });

  it('tout l\'écolage payé : plus que les connexes ; tout payé : aucune tranche à payer', () => {
    expect(detailEncaissements(eleve(150000), annee, grille).prochaine).toBe('connexe');
    expect(detailEncaissements(eleve(150000, { frais_connexe_paye: 25000 }), annee, grille).prochaine).toBeNull();
  });

  it('les paiements remplissent les tranches dans l\'ordre, et le total des tranches payées = déjà payé', () => {
    for (const paye of [0, 10000, 50000, 73000, 100000, 149999, 150000]) {
      const d = detailEncaissements(eleve(paye), annee, grille);
      const somme = d.echeances.filter((x) => x.id !== 'connexe').reduce((a, x) => a + x.montantPaye, 0);
      expect(somme, `payé ${paye}`).toBe(paye);
    }
  });

  it('un trop-perçu est signalé, sans fausser les tranches', () => {
    const d = detailEncaissements(eleve(160000), annee, grille);
    expect(d.tropPercu).toBe(10000);
    expect(parId(d).tranche3.statut).toBe('payee');
    expect(detailEncaissements(eleve(100000), annee, grille).tropPercu).toBe(0);
  });

  it('la connexe est montrée avec son propre paiement', () => {
    const e = parId(detailEncaissements(eleve(0, { frais_connexe_paye: 10000 }), annee, grille));
    expect(e.connexe).toMatchObject({ statut: 'partielle', montantPaye: 10000, montantRestant: 15000 });
  });

  it('une tranche en retard est marquée comme telle (date dépassée)', () => {
    const e = parId(detailEncaissements(eleve(0), annee, grille));
    expect(e.tranche1.enRetard).toBe(true);   // 1er octobre 2026 : passé
    expect(e.tranche2.enRetard).toBe(false);  // 15 janvier 2027 : à venir
  });

  it('sans année scolaire (pas encore chargée) ou sans élève : aucun détail, jamais d\'erreur', () => {
    expect(detailEncaissements(eleve(73000), null, grille)).toEqual({ echeances: [], prochaine: null, tropPercu: 0 });
    expect(detailEncaissements(null, annee, grille)).toEqual({ echeances: [], prochaine: null, tropPercu: 0 });
  });

  it('rien à encaisser (écolage et connexes à 0) : aucune ligne', () => {
    const d = detailEncaissements({ montant_du: 0, montant_paye: 0, frais_connexe_du: 0, frais_connexe_paye: 0 }, { date_tranche1: null, date_tranche2: null, date_tranche3: null, date_connexe: null }, null);
    expect(d.echeances).toEqual([]);
  });

  it('sans grille de frais, le dû est réparti sur les échéances configurées', () => {
    const d = detailEncaissements(eleve(0, { frais_connexe_du: 0 }), annee, null);
    expect(d.echeances.map((x) => x.montant)).toEqual([50000, 50000, 50000]);
  });
});
