// Recherche de texte sans accents ni majuscules, dans n'importe quel ordre des mots.
import { describe, it, expect } from 'vitest';
import { sansAccents, correspondAuxMots } from '../src/lib/texte.js';

describe('recherche d\'un nom', () => {
  it('ignore les majuscules et les accents', () => {
    expect(sansAccents('Élève ÇA Noël')).toBe('eleve ca noel');
    expect(correspondAuxMots('Hélène KOUASSI', 'helene')).toBe(true);
    expect(correspondAuxMots('Hélène KOUASSI', 'HÉLÈNE')).toBe(true);
    expect(correspondAuxMots('Eve Dossou', 'Ève')).toBe(true);
  });

  it('trouve dans n\'importe quel ordre des mots', () => {
    expect(correspondAuxMots('KEITA Jean', 'jean keita')).toBe(true);
    expect(correspondAuxMots('KEITA Jean', 'kei jea')).toBe(true);
  });

  it('un morceau de nom suffit, au début comme au milieu', () => {
    expect(correspondAuxMots('TRAORE Moussa', 'trao')).toBe(true);
    expect(correspondAuxMots('TRAORE Moussa', 'oussa')).toBe(true);
  });

  it('TOUS les mots doivent correspondre', () => {
    expect(correspondAuxMots('KEITA Jean', 'keita paul')).toBe(false);
    expect(correspondAuxMots('KEITA Jean', 'marie')).toBe(false);
  });

  it('une recherche vide ou faite d\'espaces correspond à tout', () => {
    for (const r of ['', '   ', null, undefined]) expect(correspondAuxMots('KEITA Jean', r), String(r)).toBe(true);
  });

  it('un texte absent ne correspond à aucune recherche non vide, sans erreur', () => {
    expect(correspondAuxMots(null, 'jean')).toBe(false);
    expect(correspondAuxMots(undefined, 'jean')).toBe(false);
  });

  it('espaces multiples et tirets sont gérés', () => {
    expect(correspondAuxMots('KOFFI Marie-Claire', '  marie   claire ')).toBe(true);
    expect(correspondAuxMots('KOFFI Marie-Claire', 'marie-claire')).toBe(true);
  });
});
