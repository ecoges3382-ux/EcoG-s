// Matières du bulletin dans le portail parent : mêmes matières que celles que voit l'équipe pour cette classe.
import { describe, it, expect } from 'vitest';
import { lireFonctionServeur, extraireFonction, compiler } from './helpers/extraire.js';

const { matieresDeLaClasse } = compiler([extraireFonction(lireFonctionServeur('parent-portal'), 'matieresDeLaClasse')], ['matieresDeLaClasse']);

// Règle de l'équipe (écrans Notes et Bulletins) : matière sans niveau, ou rattachée au NOM de la classe.
const matieresEquipe = (subjects, classeNom) => subjects.filter((su) => !su.niveau || su.niveau === classeNom);

const sujets = [
  { id: 'fr', nom: 'Français', niveau: null },
  { id: 'ma', nom: 'Maths', niveau: '5ème B' },    // propre à la classe « 5ème B » (nom de classe, comme l'écran Matières)
  { id: 'sv', nom: 'SVT', niveau: '5ème A' },      // propre à une AUTRE classe
  { id: 'ang', nom: 'Anglais', niveau: '5ème' },   // enregistrée avec le niveau pédagogique
  { id: 'es', nom: 'Espagnol', niveau: '' },
];
const ids = (l) => l.map((s) => s.id);

describe('matières du bulletin dans le portail parent', () => {
  it('élève de « 5ème B » (niveau « 5ème ») : les communes, celles de sa classe et celles de son niveau', () => {
    expect(ids(matieresDeLaClasse(sujets, '5ème B', '5ème'))).toEqual(['fr', 'ma', 'ang', 'es']);
  });

  it('jamais une matière réservée à une autre classe', () => {
    expect(ids(matieresDeLaClasse(sujets, '5ème B', '5ème'))).not.toContain('sv');
    expect(ids(matieresDeLaClasse(sujets, '5ème A', '5ème'))).toContain('sv');
    expect(ids(matieresDeLaClasse(sujets, '5ème A', '5ème'))).not.toContain('ma');
  });

  it('le cas qui posait problème : une matière propre à une classe avec section est bien visible des parents', () => {
    // avant, seule la comparaison avec le niveau (« 5ème ») existait : « Maths » (5ème B) disparaissait du bulletin
    expect(ids(matieresDeLaClasse(sujets, '5ème B', '5ème'))).toContain('ma');
  });

  it('classe sans section (nom = niveau) : rien ne change', () => {
    expect(ids(matieresDeLaClasse(sujets, '5ème', '5ème'))).toEqual(['fr', 'ang', 'es']);
  });

  it('tout ce que voit l\'équipe pour cette classe, le parent le voit aussi', () => {
    for (const [nom, niveau] of [['5ème B', '5ème'], ['5ème A', '5ème'], ['5ème', '5ème'], ['6ème C', '6ème'], [null, null]]) {
      const parent = new Set(ids(matieresDeLaClasse(sujets, nom, niveau)));
      for (const id of ids(matieresEquipe(sujets, nom))) expect(parent.has(id), `${nom} / ${id}`).toBe(true);
    }
  });

  it('élève sans classe connue : seulement les matières communes', () => {
    expect(ids(matieresDeLaClasse(sujets, null, null))).toEqual(['fr', 'es']);
  });
});
