// Grille tarifaire : les niveaux proposés sont ceux des classes, tels qu'ils y sont écrits.
import { describe, it, expect } from 'vitest';
import { niveauxDesClasses, NIVEAUX } from '../src/lib/utils.js';

const classes = (...niveaux) => niveaux.map((niveau) => ({ niveau }));

describe('niveaux des classes', () => {
  it('garde un niveau écrit « 6ème » (absent de la liste NIVEAUX) au lieu de le faire disparaître', () => {
    expect(niveauxDesClasses(classes('6ème', '6ème', '5ème'))).toEqual(['6ème', '5ème']);
  });
  it('un niveau par classe : pas de doublon', () => {
    expect(niveauxDesClasses(classes('CM2', 'CM2', 'CM2'))).toEqual(['CM2']);
  });
  it('les niveaux connus restent dans l\'ordre du primaire au lycée', () => {
    expect(niveauxDesClasses(classes('3e', 'CP', 'Tle', '6e'))).toEqual(['CP', '6e', '3e', 'Tle']);
  });
  it('l\'ordre est le même quand le niveau est écrit autrement', () => {
    expect(niveauxDesClasses(classes('3ème', '6ème', '4ème', '5ème'))).toEqual(['6ème', '5ème', '4ème', '3ème']);
    expect(niveauxDesClasses(classes('Terminale', 'Seconde', 'Première'))).toEqual(['Seconde', 'Première', 'Terminale']);
  });
  it('un niveau inconnu passe à la fin, sans rien perdre', () => {
    expect(niveauxDesClasses(classes('Atelier', 'CP'))).toEqual(['CP', 'Atelier']);
  });
  it('aucune classe, ou des classes sans niveau : liste vide', () => {
    expect(niveauxDesClasses([])).toEqual([]);
    expect(niveauxDesClasses(null)).toEqual([]);
    expect(niveauxDesClasses([{ niveau: null }, {}])).toEqual([]);
  });
  it('tous les niveaux de la liste générique sont conservés', () => {
    expect(niveauxDesClasses(classes(...NIVEAUX).reverse())).toEqual(NIVEAUX);
  });
});
