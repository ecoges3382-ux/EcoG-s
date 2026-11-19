// Notes d'un élève sur sa fiche : rangées par matière, moyennes identiques à celles du bulletin.
import { describe, it, expect } from 'vitest';
import { resumeNotesEleve, periodesAvecNotes, periodeParDefaut, pointsEvolution } from '../src/lib/studentGrades.js';
import { periodeMoyenneGenerale, subjectPeriodeMoyenne, annualMoyenneGenerale } from '../src/lib/bulletin.js';

const E = 'eleve-1';
let n = 0;
const note = (subject_id, periode, type, valeur, sur = 20, created_at = `2026-10-${String(10 + (n++ % 18)).padStart(2, '0')}T10:00:00Z`) => ({ id: 'g' + n, student_id: E, subject_id, periode, type, note: valeur, sur, created_at });
const matieres = [{ id: 'fr', nom: 'Français', coefficient: 3 }, { id: 'ma', nom: 'Maths', coefficient: 4 }, { id: 'sv', nom: 'SVT', coefficient: 2 }, { id: 'ang', nom: 'Anglais', coefficient: 2, niveau: 'Autre classe' }];
const notes = [
  note('ma', 'Trimestre 1', 'controle', 10), note('ma', 'Trimestre 1', 'controle', 14), note('ma', 'Trimestre 1', 'devoir', 16),
  note('fr', 'Trimestre 1', 'devoir', 12), note('fr', 'Trimestre 1', 'examen', 5),
  note('ma', 'Trimestre 2', 'devoir', 8), note('fr', 'Trimestre 2', 'devoir', 15),
  note('ang', 'Trimestre 1', 'devoir', 18),
];

describe('notes d\'un trimestre, matière par matière', () => {
  const r = resumeNotesEleve(notes, matieres, E, 'Trimestre 1');

  it('liste les matières dans l\'ordre alphabétique, avec leurs notes', () => {
    expect(r.lignes.map((l) => l.matiere.nom)).toEqual(['Anglais', 'Français', 'Maths']);
    expect(r.lignes.find((l) => l.matiere.id === 'ma').notes.map((x) => x.note)).toEqual([10, 14, 16]);
  });

  it('la moyenne d\'une matière est celle du bulletin (interros ensemble, chaque devoir à part)', () => {
    const maths = r.lignes.find((l) => l.matiere.id === 'ma');
    expect(maths.moyenne).toBeCloseTo(14, 10); // interros (10+14)/2 = 12 ; devoir 16 ; (12+16)/2 = 14
    expect(maths.moyenne).toBeCloseTo(subjectPeriodeMoyenne(notes, E, 'ma', 'Trimestre 1'), 10);
  });

  it('un examen est affiché mais ne compte pas dans la moyenne', () => {
    const fr = r.lignes.find((l) => l.matiere.id === 'fr');
    expect(fr.notes.map((x) => x.type)).toEqual(['devoir', 'examen']);
    expect(fr.moyenne).toBeCloseTo(12, 10);
  });

  it('la moyenne générale est pondérée par les coefficients, comme sur le bulletin', () => {
    const attendu = periodeMoyenneGenerale(matieres, notes, E, 'Trimestre 1');
    expect(r.generale).toBeCloseTo(attendu, 10);
    // maths 14 (coef 4), français 12 (coef 3), anglais 18 (coef 2) : (56 + 36 + 36) / 9
    expect(r.generale).toBeCloseTo((14 * 4 + 12 * 3 + 18 * 2) / 9, 10);
  });

  it('une matière réservée à une autre classe n\'est PAS cachée : ses notes sont là', () => {
    expect(r.lignes.some((l) => l.matiere.id === 'ang')).toBe(true);
  });

  it('une matière sans note ce trimestre n\'apparaît pas', () => {
    expect(r.lignes.some((l) => l.matiere.id === 'sv')).toBe(false);
    expect(resumeNotesEleve(notes, matieres, E, 'Trimestre 2').lignes.map((l) => l.matiere.nom)).toEqual(['Français', 'Maths']);
  });

  it('donne l\'appréciation de la moyenne générale', () => {
    expect(r.appreciation).toBeTruthy();
    expect(resumeNotesEleve(notes, matieres, E, 'Trimestre 3').appreciation).toBeNull();
  });
});

describe('vue annuelle', () => {
  const a = resumeNotesEleve(notes, matieres, E, 'annuel');

  it('moyenne de chaque trimestre noté, et moyenne annuelle', () => {
    const maths = a.lignes.find((l) => l.matiere.id === 'ma');
    expect(maths.parTrimestre.map((t) => t.moyenne)).toEqual([expect.closeTo(14, 10), 8, null]);
    expect(maths.moyenne).toBeCloseTo(11, 10); // (14 + 8) / 2 : le trimestre sans note ne compte pas
    expect(a.generale).toBeCloseTo(annualMoyenneGenerale(matieres, notes, E), 10);
  });

  it('toutes les notes des trimestres, rangées par matière', () => {
    expect(a.lignes.find((l) => l.matiere.id === 'ma').notes).toHaveLength(4);
    expect(a.nbNotes).toBe(8);
  });
});

describe('périodes', () => {
  it('seulement celles qui ont des notes, dans l\'ordre de l\'année', () => {
    expect(periodesAvecNotes([note('fr', 'Trimestre 3', 'devoir', 10), note('fr', 'Trimestre 1', 'devoir', 10)])).toEqual(['Trimestre 1', 'Trimestre 3']);
    expect(periodesAvecNotes([])).toEqual([]);
  });

  it('période affichée au départ : le dernier trimestre noté', () => {
    expect(periodeParDefaut(notes)).toBe('Trimestre 2');
    expect(periodeParDefaut([note('fr', 'Trimestre 1', 'devoir', 10)])).toBe('Trimestre 1');
    expect(periodeParDefaut([])).toBeNull();
  });

  it('une période hors trimestres (semestre) reste visible', () => {
    const s = [note('fr', 'Semestre 1', 'devoir', 12)];
    expect(periodesAvecNotes(s)).toEqual(['Semestre 1']);
    expect(resumeNotesEleve(s, matieres, E, 'Semestre 1').lignes[0].moyenne).toBeCloseTo(12, 10);
  });
});

describe('points de la courbe', () => {
  it('un point par trimestre, vide si pas de note', () => {
    const p = pointsEvolution(notes, matieres, E);
    expect(p.map((x) => x.name)).toEqual(['T1', 'T2', 'T3']);
    expect(p[0].value).toBeCloseTo(periodeMoyenneGenerale(matieres, notes, E, 'Trimestre 1'), 10);
    expect(p[2].value).toBeNull();
  });
});

describe('élève sans note', () => {
  it('aucune ligne, aucune moyenne, sans erreur', () => {
    const r = resumeNotesEleve([], matieres, E, 'Trimestre 1');
    expect(r).toEqual({ lignes: [], generale: null, appreciation: null, nbNotes: 0 });
    expect(resumeNotesEleve(undefined, undefined, E, 'annuel').lignes).toEqual([]);
  });
});

describe('libellé d\'une note dans une pastille', () => {
  it('« 14/20 » : le barème est toujours affiché', async () => {
    const { libelleNote } = await import('../src/lib/studentGrades.js');
    expect(libelleNote({ note: 14, sur: 20 })).toBe('14/20');
    expect(libelleNote({ note: '10.5', sur: '20' })).toBe('10.5/20');
  });

  it('un autre barème s\'affiche tel quel (8/10, 30/40)', async () => {
    const { libelleNote } = await import('../src/lib/studentGrades.js');
    expect(libelleNote({ note: 8, sur: 10 })).toBe('8/10');
    expect(libelleNote({ note: 30, sur: 40 })).toBe('30/40');
  });

  it('un barème absent ou illisible ne casse rien (note seule, jamais « 12/0 »)', async () => {
    const { libelleNote } = await import('../src/lib/studentGrades.js');
    expect(libelleNote({ note: 12, sur: null })).toBe('12');
    expect(libelleNote({ note: 12 })).toBe('12');
    expect(libelleNote({ note: 12, sur: 0 })).toBe('12');
  });
});
