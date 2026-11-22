// Payer plusieurs tranches d'un coup : cocher la 1ère et la 2ème, valider, un seul paiement de la somme.
import { describe, it, expect } from 'vitest';
import {
  optionsPaiement, montantPropose, choisirTranche, basculerTranche, tranchesCochees, identifiantTranches, trancheValidePourType,
} from '../src/lib/paymentForm.js';
import { trancheLabel } from '../src/lib/utils.js';

const annee = { date_tranche1: '2026-10-01', date_tranche2: '2026-12-15', date_tranche3: '2027-03-01' };
const grille = { montant_tranche1: 100000, montant_tranche2: 100000, montant_tranche3: 100000 };
const eleve = (paye) => ({ montant_du: 300000, montant_paye: paye, frais_connexe_du: 0, frais_connexe_paye: 0 });
const choix = (paye) => optionsPaiement('scolarite', eleve(paye), annee, grille);

describe('cocher plusieurs tranches', () => {
  it('cocher la 2ème coche aussi la 1ère (on paie dans l\'ordre)', () => {
    expect(basculerTranche(choix(0), [], 'tranche2')).toEqual(['tranche1', 'tranche2']);
  });
  it('cocher la 3ème coche les trois', () => {
    expect(basculerTranche(choix(0), [], 'tranche3')).toEqual(['tranche1', 'tranche2', 'tranche3']);
  });
  it('décocher la 1ère décoche aussi les suivantes', () => {
    expect(basculerTranche(choix(0), ['tranche1', 'tranche2'], 'tranche1')).toEqual([]);
  });
  it('décocher la 2ème garde la 1ère', () => {
    expect(basculerTranche(choix(0), ['tranche1', 'tranche2', 'tranche3'], 'tranche2')).toEqual(['tranche1']);
  });
  it('une tranche déjà soldée n\'est plus proposée : on part de la première à payer', () => {
    expect(basculerTranche(choix(100000), [], 'tranche3')).toEqual(['tranche2', 'tranche3']);
  });
  it('un identifiant qui n\'est pas une tranche ne change rien', () => {
    expect(basculerTranche(choix(0), ['tranche1'], 'complet')).toEqual(['tranche1']);
  });
});

describe('montant de plusieurs tranches', () => {
  it('1ère + 2ème = la somme de ce qui reste sur chacune', () => {
    expect(montantPropose(choix(0), 'tranche1+tranche2')).toBe(200000);
  });
  it('une tranche déjà entamée compte pour son reste', () => {
    expect(montantPropose(choix(40000), 'tranche1+tranche2')).toBe(160000); // 60 000 + 100 000
  });
  it('une seule tranche : comme avant', () => {
    expect(montantPropose(choix(0), 'tranche1')).toBe(100000);
    expect(montantPropose(choix(0), 'moitie')).toBe(150000);
  });
  it('rien à proposer si les tranches n\'existent plus', () => {
    expect(montantPropose(choix(300000), 'tranche1+tranche2')).toBeNull();
  });
});

describe('sélection valide', () => {
  it('plusieurs tranches encore à payer : conservé', () => {
    expect(choisirTranche(choix(0), 'tranche1+tranche2')).toBe('tranche1+tranche2');
  });
  it('si l\'une est soldée entre-temps : retour à un choix valide', () => {
    expect(choisirTranche(choix(100000), 'tranche1+tranche2')).not.toBe('tranche1+tranche2');
  });
  it('tranchesCochees', () => {
    expect(tranchesCochees('tranche1+tranche2')).toEqual(['tranche1', 'tranche2']);
    expect(tranchesCochees('complet')).toEqual([]);
    expect(tranchesCochees('tranche1+complet')).toEqual([]);
  });
  it('identifiantTranches recolle avec « + »', () => {
    expect(identifiantTranches(['tranche1', 'tranche2'])).toBe('tranche1+tranche2');
    expect(identifiantTranches([])).toBe('');
  });
  it('permise pour l\'écolage seulement', () => {
    expect(trancheValidePourType('scolarite', 'tranche1+tranche2')).toBe(true);
    expect(trancheValidePourType('connexe', 'tranche1+tranche2')).toBe(false);
  });
});

describe('affichage d\'un paiement de plusieurs tranches', () => {
  it('« 1ère + 2ème tranche »', () => {
    expect(trancheLabel('tranche1+tranche2')).toBe('1ère + 2ème tranche');
    expect(trancheLabel('tranche1+tranche2+tranche3')).toBe('1ère + 2ème + 3ème tranche');
  });
  it('les libellés d\'avant ne changent pas', () => {
    expect(trancheLabel('tranche2')).toBe('2ème tranche');
    expect(trancheLabel('complet')).toBe('Complet');
    expect(trancheLabel('partiel')).toBe('Partiel');
    expect(trancheLabel(undefined)).toBeUndefined(); // comme avant
  });
});
