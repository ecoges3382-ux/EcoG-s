// Rappels automatiques : réglages de l'école, qui est relancé, calendrier des prochains envois, et parité avec la fonction serveur.
import { describe, it, expect } from 'vitest';
import { reglagesRappels, sousMoratoire, prochainsRappels, JALONS } from '../src/lib/rappelsAuto.js';
import { lireFonctionServeur, extraireFonction, extraireConstante, compiler } from './helpers/extraire.js';

const serveur = (() => {
  const source = lireFonctionServeur('cron-reminders');
  return compiler([extraireConstante(source, 'MILESTONES'), extraireFonction(source, 'reglagesRappels')], ['reglagesRappels']).reglagesRappels;
})();

const CAS = [
  undefined, null, {}, { rappels_auto: true, rappels_jalons: [15, 7, 3, -3] }, { rappels_auto: false, rappels_jalons: [15, 7, 3, -3] },
  { rappels_auto: true, rappels_jalons: [7] }, { rappels_auto: true, rappels_jalons: [] }, { rappels_auto: true, rappels_jalons: [99, 3] },
  { rappels_auto: null, rappels_jalons: null }, { rappels_auto: true, rappels_jalons: [-3, 15] },
];

describe('réglages des rappels', () => {
  it('sans réglage enregistré : tout est activé, comme avant', () => {
    expect(reglagesRappels(null)).toEqual({ actif: true, jalons: JALONS });
    expect(reglagesRappels({})).toEqual({ actif: true, jalons: JALONS });
  });
  it('un interrupteur coupé désactive', () => expect(reglagesRappels({ rappels_auto: false }).actif).toBe(false));
  it('garde les jalons choisis, dans l\'ordre habituel, et ignore les inconnus', () => {
    expect(reglagesRappels({ rappels_jalons: [-3, 7, 99] }).jalons).toEqual([7, -3]);
  });
  it('aucun jalon coché : liste vide (rien ne part)', () => expect(reglagesRappels({ rappels_jalons: [] }).jalons).toEqual([]));
  it('la fonction serveur donne exactement les mêmes réglages que l\'application', () => {
    for (const cas of CAS) expect(serveur(cas), JSON.stringify(cas)).toEqual(reglagesRappels(cas));
  });
});

describe('moratoire', () => {
  it('moratoire actif ou note d\'arrangement : pas de rappel', () => {
    expect(sousMoratoire({ moratoire_actif: true })).toBe(true);
    expect(sousMoratoire({ note_arrangement: 'Paie en décembre' })).toBe(true);
  });
  it('sinon, relancé', () => {
    expect(sousMoratoire({ moratoire_actif: false, note_arrangement: '  ' })).toBe(false);
    expect(sousMoratoire({})).toBe(false);
  });
});

describe('prochains rappels', () => {
  const annee = { date_tranche1: '2026-10-01', date_tranche2: '2026-12-15', date_tranche3: '2027-03-01', date_connexe: null };
  const eleve = (id, nom, paye, extra = {}) => ({ id, full_name: nom, montant_du: 300000, montant_paye: paye, frais_connexe_du: 0, frais_connexe_paye: 0, feeSchedule: { montant_tranche1: 100000, montant_tranche2: 100000, montant_tranche3: 100000 }, ...extra });
  const eleves = [eleve('a', 'AGOSSOU', 0), eleve('b', 'BIO', 150000), eleve('c', 'CAKPO', 300000), eleve('d', 'DOSSOU', 0, { moratoire_actif: true })];
  const auj = new Date(2026, 10, 30); // 30 novembre 2026

  it('liste les envois de la 2ème tranche (échéance le 15 décembre) : J-15, J-7, J-3 avant et 3 jours après', () => {
    const r = prochainsRappels({ schoolYear: annee, eleves, aujourdhui: auj });
    const t2 = r.filter((x) => x.type === 'tranche2');
    expect(t2.map((x) => [x.jalon, x.jours])).toEqual([[15, 0], [7, 8], [3, 12], [-3, 18]]);
  });
  it('ne cite que ceux à qui il reste un solde sur cette échéance, sans les moratoires', () => {
    const r = prochainsRappels({ schoolYear: annee, eleves, aujourdhui: auj });
    const j7 = r.find((x) => x.type === 'tranche2' && x.jalon === 7);
    expect(j7.eleves.map((x) => x.id)).toEqual(['a', 'b']); // b a payé la 1ère tranche et la moitié de la 2ème ; c a tout payé ; d est sous moratoire
  });
  it('respecte les jalons choisis', () => {
    const r = prochainsRappels({ schoolYear: annee, eleves, jalons: [3], aujourdhui: auj });
    expect(r.every((x) => x.jalon === 3)).toBe(true);
  });
  it('rien au-delà de l\'horizon, rien dans le passé', () => {
    const r = prochainsRappels({ schoolYear: annee, eleves, aujourdhui: auj, horizonJours: 10 });
    expect(r.every((x) => x.jours >= 0 && x.jours <= 10)).toBe(true);
    expect(r.some((x) => x.type === 'tranche1')).toBe(false); // échéance du 1er octobre : passée
  });
  it('une échéance sans date configurée ne donne rien', () => {
    expect(prochainsRappels({ schoolYear: { date_tranche1: null }, eleves, aujourdhui: auj })).toEqual([]);
  });
  it('pas d\'année scolaire ou pas d\'élèves : rien', () => {
    expect(prochainsRappels({ schoolYear: null, eleves, aujourdhui: auj })).toEqual([]);
    expect(prochainsRappels({ schoolYear: annee, eleves: [], aujourdhui: auj })).toEqual([]);
  });
  it('les envois sont triés par date', () => {
    const r = prochainsRappels({ schoolYear: annee, eleves, aujourdhui: auj, horizonJours: 120 });
    for (let i = 1; i < r.length; i++) expect(r[i].jours).toBeGreaterThanOrEqual(r[i - 1].jours);
  });
});
