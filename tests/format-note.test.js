// Écriture des notes et des moyennes : virgule décimale partout, « /20 » écrit normalement sur les bulletins.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { virgule, noteTexte, noteAvecBareme, moyenneBulletin } from '../src/lib/formatNote.js';

describe('virgule décimale', () => {
  it('une moyenne a deux décimales et une virgule', () => {
    expect(virgule(11.68)).toBe('11,68');
    expect(virgule(14.5)).toBe('14,50');
    expect(virgule('13.016')).toBe('13,02');
    expect(virgule(12.66, 1)).toBe('12,7');
  });

  it('une note garde ses décimales saisies, avec la virgule', () => {
    expect(noteTexte(14)).toBe('14');
    expect(noteTexte('12.7')).toBe('12,7');
    expect(noteTexte(9.25)).toBe('9,25');
    expect(noteTexte(0)).toBe('0');
  });

  it('note + barème en texte simple', () => {
    expect(noteAvecBareme({ note: 12.7, sur: 20 })).toBe('12,7/20');
    expect(noteAvecBareme({ note: 8, sur: 10 })).toBe('8/10');
    expect(noteAvecBareme({ note: 12, sur: null })).toBe('12');
  });
});

describe('bulletins : écriture normale', () => {
  it('« 14,50/20 », sans espace, virgule', () => {
    expect(moyenneBulletin(14.5)).toBe('14,50/20');
    expect(moyenneBulletin(9.083)).toBe('9,08/20');
  });

  it('pas de moyenne : un tiret', () => {
    expect(moyenneBulletin(null)).toBe('—');
    expect(moyenneBulletin(undefined)).toBe('—');
  });
});

describe('où le /20 petit et grisé s\'applique, et où il ne s\'applique pas', () => {
  const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

  it('les deux bulletins (portail parent et page Bulletins) n\'utilisent PAS le composant Sur20', () => {
    expect(lire('../src/components/parent/ChildBulletin.jsx')).not.toContain('Sur20');
    expect(lire('../src/pages/Grades.jsx')).not.toContain('Sur20');
  });

  it('les deux bulletins écrivent leurs moyennes avec moyenneBulletin, plus de toFixed à point décimal', () => {
    for (const f of ['../src/components/parent/ChildBulletin.jsx', '../src/pages/Grades.jsx']) {
      const code = lire(f);
      expect(code).toContain('moyenneBulletin');
      expect(code).not.toMatch(/\.toFixed\(2\)/);
    }
  });

  it('le tableau des notes, la page Notes, la courbe, le tableau de bord et les rapports utilisent Sur20', () => {
    for (const f of ['../src/components/NotesParMatiere.jsx', '../src/pages/Notes.jsx', '../src/components/GradesTrendChart.jsx', '../src/components/dashboard/YearKpis.jsx', '../src/components/dashboard/ClassBreakdown.jsx', '../src/components/reports/SyntheseReport.jsx', '../src/components/reports/ResultatsReport.jsx']) {
      expect(lire(f)).toContain('Sur20');
    }
  });
});
