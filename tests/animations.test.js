import { describe, it, expect } from 'vitest';
import {
  modeEffectif, appareilLent, lireReglage, ecrireReglage, decouperTexte, positionCible, positionEn, easeOutExpo, CLE_REGLAGE,
} from '../src/lib/animations.js';

const faux = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

describe('mode des animations', () => {
  it('automatique : complet, sauf mouvement réduit demandé ou appareil lent', () => {
    expect(modeEffectif({})).toBe('complet');
    expect(modeEffectif({ mouvementReduit: true })).toBe('reduit');
    expect(modeEffectif({ lent: true })).toBe('reduit');
  });
  it('le choix de la personne l\'emporte sur l\'automatique, dans les deux sens', () => {
    expect(modeEffectif({ reglage: 'complet', mouvementReduit: true, lent: true })).toBe('complet');
    expect(modeEffectif({ reglage: 'reduit' })).toBe('reduit');
  });
  it('appareil lent : 2 Go ou moins, ou économie de données', () => {
    expect(appareilLent({ deviceMemory: 2 })).toBe(true);
    expect(appareilLent({ deviceMemory: 4 })).toBe(false);
    expect(appareilLent({ connection: { saveData: true } })).toBe(true);
    expect(appareilLent({})).toBe(false);
  });
  it('le réglage se lit et s\'écrit ; une valeur inconnue vaut automatique', () => {
    const st = faux();
    expect(lireReglage(st)).toBe('auto');
    ecrireReglage('reduit', st);
    expect(lireReglage(st)).toBe('reduit');
    ecrireReglage('auto', st);
    expect(st.getItem(CLE_REGLAGE)).toBe(null);
    st.setItem(CLE_REGLAGE, 'n-importe-quoi');
    expect(lireReglage(st)).toBe('auto');
  });
});

describe('chiffres qui roulent', () => {
  it('seuls les chiffres deviennent des colonnes, le reste reste fixe', () => {
    const m = decouperTexte('4 850 F');
    expect(m.map((x) => x.chiffre)).toEqual([4, null, 8, 5, 0, null, null]);
    expect(m.map((x) => x.c).join('')).toBe('4 850 F');
  });
  it('la clé est la position depuis la fin : les colonnes gardent leur place quand le nombre s\'allonge', () => {
    const a = decouperTexte('999'); const b = decouperTexte('1 000');
    expect(a.map((x) => x.cle)).toEqual([3, 2, 1]);
    expect(b[b.length - 1].cle).toBe(1);
  });
  it('texte absent ou numérique : pas d\'erreur', () => {
    expect(decouperTexte(undefined)).toEqual([]);
    expect(decouperTexte(78)).toHaveLength(2);
  });
  it('la bande s\'arrête sur le chiffre de la seconde série et la courbe va de 0 à 1', () => {
    expect(positionCible(0)).toBe(10);
    expect(positionCible(9)).toBe(19);
    expect(easeOutExpo(0)).toBeCloseTo(0, 2);
    expect(easeOutExpo(1)).toBe(1);
    expect(positionEn(0, 17, 1)).toBe(17);
    expect(positionEn(3, 13, 0)).toBe(3);
  });
});
