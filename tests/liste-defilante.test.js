// Hauteur d'une liste qui défile dans son cadre (comptes utilisateurs, accès parents) : la place restante sous son début de page.
import { describe, it, expect } from 'vitest';
import { calculerHauteurListe } from '../src/lib/useHauteurListe.js';

describe('hauteur d\'une liste qui défile dans son cadre', () => {
  it('ordinateur : la place restante, moins une petite marge', () => {
    expect(calculerHauteurListe({ hauteurFenetre: 800, largeurFenetre: 1280, hautListe: 250 })).toBe(526);
  });

  it('ordinateur : jamais moins de 200 px, même si le haut de la liste est très bas', () => {
    expect(calculerHauteurListe({ hauteurFenetre: 800, largeurFenetre: 1280, hautListe: 700 })).toBe(200);
  });

  it('téléphone : on laisse la place de la barre du bas', () => {
    expect(calculerHauteurListe({ hauteurFenetre: 844, largeurFenetre: 390, hautListe: 300 })).toBe(448);
  });

  it('téléphone : au moins ~4 lignes (290 px) même avec un en-tête haut ; la page défile alors', () => {
    expect(calculerHauteurListe({ hauteurFenetre: 664, largeurFenetre: 390, hautListe: 510 })).toBe(290);
  });

  it('la limite entre téléphone et ordinateur est à 900 px de large', () => {
    expect(calculerHauteurListe({ hauteurFenetre: 800, largeurFenetre: 900, hautListe: 250 })).toBe(454);
    expect(calculerHauteurListe({ hauteurFenetre: 800, largeurFenetre: 901, hautListe: 250 })).toBe(526);
  });
});
