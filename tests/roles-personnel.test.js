// Rôles du personnel : affichage avec majuscule et accent, sans toucher aux valeurs enregistrées.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { libelleRolePersonnel, estEnseignant } from '../src/lib/utils.js';

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

describe('enseignant, quelle que soit l\'écriture en base', () => {
  it('reconnaît « Enseignant » et « enseignant »', () => {
    expect(estEnseignant('Enseignant')).toBe(true);
    expect(estEnseignant('enseignant')).toBe(true);
    expect(estEnseignant(' ENSEIGNANT ')).toBe(true);
  });
  it('les autres rôles ne sont pas des enseignants', () => {
    expect(estEnseignant('directeur')).toBe(false);
    expect(estEnseignant('Secrétaire')).toBe(false);
    expect(estEnseignant(null)).toBe(false);
    expect(estEnseignant(undefined)).toBe(false);
  });
});

describe('les enseignants sont demandés sans tenir compte de la casse', () => {
  it('aucune page ne filtre le rôle avec « = Enseignant » (un enseignant enregistré en minuscules disparaîtrait des listes)', () => {
    const dossier = path.resolve(import.meta.dirname, '../src');
    const fautifs = [];
    const parcourir = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const chemin = path.join(d, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (/\.(jsx?|tsx?)$/.test(e.name) && /\.eq\('role',\s*'Enseignant'\)/.test(fs.readFileSync(chemin, 'utf8'))) fautifs.push(path.relative(dossier, chemin));
    });
    parcourir(dossier);
    expect(fautifs).toEqual([]);
  });
});
