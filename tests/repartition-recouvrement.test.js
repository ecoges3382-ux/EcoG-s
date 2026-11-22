// Recouvrement : la répartition des élèves sépare « partiel » et « rien payé », sans compter personne deux fois.
import { describe, it, expect } from 'vitest';
import { repartitionEleves } from '../src/lib/repartitionRecouvrement.js';

const e = (statutKey, montant_paye = 0, frais_connexe_paye = 0) => ({ statutKey, montant_paye, frais_connexe_paye });

describe('répartition des élèves (Recouvrement)', () => {
  it('sépare ceux qui ont déjà payé une partie de ceux qui n\'ont rien payé', () => {
    const r = repartitionEleves([e('dans_les_delais', 50000), e('dans_les_delais', 0), e('solde_restant', 0, 10000), e('solde_restant')]);
    expect(r).toMatchObject({ partiels: 2, rienPaye: 2, enRetard: 0, payes: 0 });
  });
  it('un élève en retard reste « en retard », même s\'il a payé une partie, et on compte combien', () => {
    const r = repartitionEleves([e('a_relancer', 100000), e('a_relancer', 0), e('a_relancer', 0, 5000)]);
    expect(r).toMatchObject({ enRetard: 3, enRetardAvecPaiement: 2, partiels: 0, rienPaye: 0 });
  });
  it('payé en totalité', () => {
    expect(repartitionEleves([e('a_jour', 150000), e('a_jour')]).payes).toBe(2);
  });
  it('un moratoire compte « dans les délais », partiel ou rien payé selon ce qui est payé', () => {
    const r = repartitionEleves([e('moratoire', 20000), e('moratoire'), e('moratoire_expirant', 1000), e('moratoire_expirant')]);
    expect(r).toMatchObject({ partiels: 2, rienPaye: 2 });
  });
  it('chaque élève est dans un seul groupe : le total des groupes est le nombre d\'élèves', () => {
    const eleves = [e('a_jour', 1), e('a_relancer', 1), e('a_relancer'), e('dans_les_delais', 1), e('dans_les_delais'), e('moratoire'), e('solde_restant', 5)];
    const r = repartitionEleves(eleves);
    expect(r.payes + r.partiels + r.rienPaye + r.enRetard).toBe(eleves.length);
  });
  it('des montants absents ou textuels ne font pas planter', () => {
    const r = repartitionEleves([{ statutKey: 'solde_restant' }, { statutKey: 'solde_restant', montant_paye: '25000' }, null].filter(Boolean));
    expect(r).toMatchObject({ rienPaye: 1, partiels: 1 });
  });
  it('liste vide ou absente : tout à zéro', () => {
    expect(repartitionEleves([])).toEqual({ payes: 0, partiels: 0, rienPaye: 0, enRetard: 0, enRetardAvecPaiement: 0 });
    expect(repartitionEleves(null).enRetard).toBe(0);
  });
});
