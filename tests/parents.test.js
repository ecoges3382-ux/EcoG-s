// Parents : repérer un doublon (même nom ET même numéro) avant de créer un deuxième parent.
import { describe, it, expect } from 'vitest';
import { trouverDoublonsParent, cleNumero, parentCorrespond, parentDansFiltre } from '../src/lib/parents.js';

const parents = [
  { id: 'p1', nom: 'KEITA', prenom: 'Ina', full_name: 'KEITA Ina', phone: '+22901 96159994' },
  { id: 'p2', nom: 'SANOGO', prenom: 'Diane', full_name: 'SANOGO Diane', phone: '+22997703154' },
  { id: 'p3', nom: 'NDIAYE', prenom: 'Binta', full_name: 'NDIAYE Binta', phone: null },
  { id: 'p4', nom: null, prenom: null, full_name: 'AKAMBI John', phone: '+22901 97000000' },
];

describe('numéros : même personne, ancien ou nouveau format', () => {
  it('compare les 8 derniers chiffres', () => {
    expect(cleNumero('+229 97703154')).toBe('97703154');
    expect(cleNumero('+229 01 97 70 31 54')).toBe('97703154');
    expect(cleNumero('0022997703154')).toBe('97703154');
  });
  it('un numéro vide ou trop court ne donne aucune clé', () => {
    expect(cleNumero('')).toBe('');
    expect(cleNumero(null)).toBe('');
    expect(cleNumero('12345')).toBe('');
  });
});

describe('doublons de parent', () => {
  it('trouve le même nom avec le même numéro', () => {
    expect(trouverDoublonsParent(parents, { nom: 'KEITA', prenom: 'Ina', phone: '+22901 96159994' }).map((p) => p.id)).toEqual(['p1']);
  });
  it('reconnaît un numéro écrit à l\'ancien format (8 chiffres) face au nouveau (01 + 8 chiffres)', () => {
    expect(trouverDoublonsParent(parents, { nom: 'SANOGO', prenom: 'Diane', phone: '+22901 97703154' }).map((p) => p.id)).toEqual(['p2']);
  });
  it('ne tient compte ni des majuscules, ni des accents, ni de l\'ordre des mots', () => {
    expect(trouverDoublonsParent(parents, { nom: 'ina', prenom: 'keïta', phone: '+22901 96159994' }).map((p) => p.id)).toEqual(['p1']);
  });
  it('utilise le nom complet quand nom et prénom ne sont pas séparés', () => {
    expect(trouverDoublonsParent(parents, { nom: 'AKAMBI', prenom: 'John', phone: '+22901 97000000' }).map((p) => p.id)).toEqual(['p4']);
  });
  it('même numéro mais autre nom : pas un doublon (deux parents peuvent partager un téléphone)', () => {
    expect(trouverDoublonsParent(parents, { nom: 'KEITA', prenom: 'Moussa', phone: '+22901 96159994' })).toEqual([]);
  });
  it('même nom mais autre numéro : pas un doublon', () => {
    expect(trouverDoublonsParent(parents, { nom: 'KEITA', prenom: 'Ina', phone: '+22901 90000000' })).toEqual([]);
  });
  it('sans numéro saisi, ne propose rien (risque de confondre deux homonymes)', () => {
    expect(trouverDoublonsParent(parents, { nom: 'NDIAYE', prenom: 'Binta', phone: '' })).toEqual([]);
    expect(trouverDoublonsParent(parents, { nom: 'NDIAYE', prenom: 'Binta', phone: null })).toEqual([]);
  });
  it('liste vide ou absente : rien', () => {
    expect(trouverDoublonsParent([], { nom: 'A', prenom: 'B', phone: '+22901 96159994' })).toEqual([]);
    expect(trouverDoublonsParent(null, { nom: 'A', prenom: 'B', phone: '+22901 96159994' })).toEqual([]);
  });
});

describe('recherche et filtres de la page Parents', () => {
  const ina = { id: 'p1', nom: 'KEITA', prenom: 'Ina', full_name: 'KEITA Ina', phone: '+22901 97703154', parent_access_students: [{ students: { id: 'e1' } }] };
  const helene = { id: 'p2', nom: 'DOSSOU', prenom: 'Hélène', full_name: 'DOSSOU Hélène', phone: null, parent_access_students: [{ students: { id: 'e2' } }, { students: { id: 'e3' } }] };

  it('trouve par nom, sans tenir compte des majuscules, des accents ni de l\'ordre des mots', () => {
    expect(parentCorrespond(ina, 'keita')).toBe(true);
    expect(parentCorrespond(ina, 'ina keita')).toBe(true);
    expect(parentCorrespond(helene, 'helene')).toBe(true);
    expect(parentCorrespond(helene, 'HÉLÈNE dossou')).toBe(true);
    expect(parentCorrespond(helene, 'keita')).toBe(false);
  });

  it('trouve par numéro, quelle que soit la mise en forme', () => {
    expect(parentCorrespond(ina, '97703154')).toBe(true);
    expect(parentCorrespond(ina, '97 70 31 54')).toBe(true);
    expect(parentCorrespond(ina, '+229 01 97 70')).toBe(true);
    expect(parentCorrespond(ina, '99999999')).toBe(false);
  });

  it('un parent sans numéro n\'est jamais trouvé par un numéro, sans provoquer d\'erreur', () => {
    expect(parentCorrespond(helene, '97703154')).toBe(false);
    expect(parentCorrespond({ id: 'x', full_name: 'SANS PHONE' }, '97')).toBe(false);
  });

  it('une recherche vide, d\'espaces ou absente garde tout le monde', () => {
    for (const r of ['', '   ', null, undefined]) expect(parentCorrespond(ina, r), String(r)).toBe(true);
  });

  it('tous les mots doivent correspondre', () => {
    expect(parentCorrespond(ina, 'keita paul')).toBe(false);
  });

  it('filtre « sans numéro » : aucun chiffre dans le téléphone', () => {
    expect(parentDansFiltre(helene, 'sans_numero')).toBe(true);
    expect(parentDansFiltre(ina, 'sans_numero')).toBe(false);
    expect(parentDansFiltre({ id: 'y', phone: '  ' }, 'sans_numero')).toBe(true);
  });

  it('filtre « plusieurs enfants » : au moins deux enfants rattachés', () => {
    expect(parentDansFiltre(helene, 'plusieurs_enfants')).toBe(true);
    expect(parentDansFiltre(ina, 'plusieurs_enfants')).toBe(false);
    expect(parentDansFiltre({ id: 'z' }, 'plusieurs_enfants')).toBe(false);
  });

  it('filtre « tous » (ou inconnu) : personne n\'est écarté', () => {
    expect(parentDansFiltre(ina, 'tous')).toBe(true);
    expect(parentDansFiltre(helene, 'n-importe-quoi')).toBe(true);
  });
});
