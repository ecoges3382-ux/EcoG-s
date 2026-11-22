// Rôles du personnel : affichage avec majuscule et accent, sans toucher aux valeurs enregistrées.
import { describe, it, expect } from 'vitest';
import { libelleRolePersonnel } from '../src/lib/utils.js';

describe('rôle du personnel à l\'affichage', () => {
  it('met la majuscule et l\'accent', () => {
    expect(libelleRolePersonnel('enseignant')).toBe('Enseignant');
    expect(libelleRolePersonnel('directeur')).toBe('Directeur');
    expect(libelleRolePersonnel('secretaire')).toBe('Secrétaire');
    expect(libelleRolePersonnel('censeur')).toBe('Censeur');
  });
  it('laisse correct ce qui l\'est déjà, quelle que soit la casse ou l\'accent saisi', () => {
    expect(libelleRolePersonnel('Enseignant')).toBe('Enseignant');
    expect(libelleRolePersonnel('SECRETAIRE')).toBe('Secrétaire');
    expect(libelleRolePersonnel('Secrétaire')).toBe('Secrétaire');
  });
  it('un rôle inconnu garde son texte, avec une majuscule', () => {
    expect(libelleRolePersonnel('gardien')).toBe('Gardien');
  });
  it('vide ou absent : chaîne vide', () => {
    expect(libelleRolePersonnel('')).toBe('');
    expect(libelleRolePersonnel(null)).toBe('');
    expect(libelleRolePersonnel(undefined)).toBe('');
  });
});
