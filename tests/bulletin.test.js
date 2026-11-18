// Moyennes et rangs des bulletins (src/lib/bulletin.js). Une version précédente n'acceptait que l'« index » des notes, alors
// que les écrans Notes, Bulletins et le portail parent passent la simple liste : toutes les moyennes s'affichaient vides.
import { describe, it, expect } from 'vitest';
import {
  PERIODES_BULLETIN, indexGrades, subjectPeriodeMoyenne, periodeMoyenneGenerale, annualMoyenneGenerale, subjectAnnualMoyenne, computeRang,
} from '../src/lib/bulletin.js';
import { lireFonctionServeur, extraireFonction, extraireConstante, compiler } from './helpers/extraire.js';

const note = (student_id, subject_id, periode, type, n, sur = 20) => ({ student_id, subject_id, periode, type, note: n, sur });
const T1 = 'Trimestre 1';
const matieres = [{ id: 'maths', coefficient: 3 }, { id: 'francais', coefficient: 2 }];

describe('moyenne d\'une matière sur une période', () => {
  const grades = [note('a', 'maths', T1, 'controle', 10), note('a', 'maths', T1, 'controle', 14), note('a', 'maths', T1, 'devoir', 16), note('b', 'maths', T1, 'devoir', 4)];

  it('les interrogations comptent ensemble pour UNE composante, chaque devoir compte à part', () => {
    // interros : (10 + 14) / 2 = 12 ; devoir : 16 ; moyenne = (12 + 16) / 2 = 14
    expect(subjectPeriodeMoyenne(grades, 'a', 'maths', T1)).toBeCloseTo(14, 10);
  });

  it('ramène chaque note sur 20', () => {
    expect(subjectPeriodeMoyenne([note('a', 'maths', T1, 'devoir', 15, 30)], 'a', 'maths', T1)).toBeCloseTo(10, 10);
  });

  it('donne le même résultat avec la LISTE des notes ou avec l\'INDEX', () => {
    expect(subjectPeriodeMoyenne(indexGrades(grades), 'a', 'maths', T1)).toBeCloseTo(subjectPeriodeMoyenne(grades, 'a', 'maths', T1), 10);
  });

  it('pas de note : aucune moyenne (null), jamais 0', () => {
    expect(subjectPeriodeMoyenne(grades, 'a', 'francais', T1)).toBeNull();
    expect(subjectPeriodeMoyenne(grades, 'zzz', 'maths', T1)).toBeNull();
    expect(subjectPeriodeMoyenne([], 'a', 'maths', T1)).toBeNull();
    expect(subjectPeriodeMoyenne(undefined, 'a', 'maths', T1)).toBeNull();
  });

  it('les notes de type « examen » ne comptent pas dans la moyenne', () => {
    expect(subjectPeriodeMoyenne([note('a', 'maths', T1, 'examen', 18)], 'a', 'maths', T1)).toBeNull();
  });
});

describe('moyenne générale', () => {
  const grades = [note('a', 'maths', T1, 'devoir', 12), note('a', 'francais', T1, 'devoir', 17)];

  it('pondérée par les coefficients : (12×3 + 17×2) / 5 = 14', () => {
    expect(periodeMoyenneGenerale(matieres, grades, 'a', T1)).toBeCloseTo(14, 10);
  });

  it('une matière sans note est ignorée (elle ne tire pas la moyenne vers le bas)', () => {
    expect(periodeMoyenneGenerale(matieres, [note('a', 'maths', T1, 'devoir', 12)], 'a', T1)).toBeCloseTo(12, 10);
  });

  it('aucune note du tout, ou coefficients à zéro : pas de moyenne', () => {
    expect(periodeMoyenneGenerale(matieres, [], 'a', T1)).toBeNull();
    expect(periodeMoyenneGenerale([{ id: 'maths', coefficient: 0 }], [note('a', 'maths', T1, 'devoir', 12)], 'a', T1)).toBeNull();
  });

  it('annuelle : moyenne des périodes qui ont des notes (une période vide ne compte pas)', () => {
    const g = [note('a', 'maths', 'Trimestre 1', 'devoir', 10), note('a', 'maths', 'Trimestre 3', 'devoir', 14)];
    expect(annualMoyenneGenerale(matieres, g, 'a')).toBeCloseTo(12, 10);
    expect(subjectAnnualMoyenne(g, 'a', 'maths')).toBeCloseTo(12, 10);
    expect(annualMoyenneGenerale(matieres, [], 'a')).toBeNull();
  });
});

describe('index mis en mémoire', () => {
  it('ajouter une note à la même liste est pris en compte (pas de résultat périmé)', () => {
    const grades = [note('a', 'maths', T1, 'devoir', 10)];
    expect(subjectPeriodeMoyenne(grades, 'a', 'maths', T1)).toBeCloseTo(10, 10);
    grades.push(note('a', 'maths', T1, 'devoir', 14));
    expect(subjectPeriodeMoyenne(grades, 'a', 'maths', T1)).toBeCloseTo(12, 10);
  });
});

describe('rang dans la classe', () => {
  const grades = [note('a', 'maths', T1, 'devoir', 10), note('b', 'maths', T1, 'devoir', 16), note('c', 'maths', T1, 'devoir', 13), note('d', 'maths', 'Trimestre 2', 'devoir', 19)];

  it('classe par moyenne décroissante', () => {
    expect(computeRang(matieres, grades, ['a', 'b', 'c', 'd'], 'b', T1)).toEqual({ rang: 1, total: 3 });
    expect(computeRang(matieres, grades, ['a', 'b', 'c', 'd'], 'a', T1)).toEqual({ rang: 3, total: 3 });
  });

  it('un élève sans note n\'a pas de rang, et n\'est pas compté dans le total', () => {
    expect(computeRang(matieres, grades, ['a', 'b', 'c', 'd'], 'd', T1)).toBeNull();
  });
});

// Le portail parent calcule les rangs côté serveur avec sa propre copie de ces fonctions : elle doit donner les mêmes moyennes.
describe('la copie du portail parent (serveur) donne les mêmes moyennes que l\'application', () => {
  const source = lireFonctionServeur('parent-portal');
  const serveur = compiler(
    [extraireConstante(source, 'PERIODES_BULLETIN'), ...['subjectPeriodeMoyenne', 'periodeMoyenneGenerale', 'annualMoyenneGenerale'].map((n) => extraireFonction(source, n))],
    ['subjectPeriodeMoyenne', 'periodeMoyenneGenerale', 'annualMoyenneGenerale'],
  );

  function alea(graine) { let s = graine; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

  it('600 jeux de notes tirés au hasard, périodes et matières comprises', () => {
    const r = alea(7);
    const types = ['controle', 'devoir', 'examen'];
    for (let i = 0; i < 600; i++) {
      const subs = [1, 2, 3].map((k) => ({ id: `m${k}`, coefficient: Math.floor(r() * 4) }));
      const grades = [];
      const nb = Math.floor(r() * 25);
      for (let k = 0; k < nb; k++) {
        grades.push(note('a', `m${1 + Math.floor(r() * 3)}`, PERIODES_BULLETIN[Math.floor(r() * 3)], types[Math.floor(r() * 3)], Math.round(r() * 40) / 2, r() < 0.2 ? 10 : 20));
      }
      const egal = (x, y) => (x === null || y === null ? x === y : Math.abs(x - y) < 1e-9);
      for (const p of PERIODES_BULLETIN) expect(egal(periodeMoyenneGenerale(subs, grades, 'a', p), serveur.periodeMoyenneGenerale(subs, grades, 'a', p)), `cas ${i}, ${p}`).toBe(true);
      expect(egal(annualMoyenneGenerale(subs, grades, 'a'), serveur.annualMoyenneGenerale(subs, grades, 'a')), `cas ${i}, annuelle`).toBe(true);
    }
  });
});
