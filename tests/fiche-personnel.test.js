// Retrouver la fiche du personnel d'une personne connue par son compte : e-mail, téléphone, nom ; jamais en cas de doute.
import { describe, it, expect } from 'vitest';
import { trouverFiche } from '../src/lib/fichePersonnel.js';

const personnel = [
  { id: 'a', full_name: 'AGOSSOU Koffi', email: 'koffi@ecole.bj', phone: '+2290197000001' },
  { id: 'b', full_name: 'MENSAH Ismaël', email: null, phone: '+22997000002' },
  { id: 'c', full_name: 'TRAORE Franck', email: 'franck@ecole.bj', phone: null },
  { id: 'd', full_name: 'KONE Jean', email: null, phone: null },
  { id: 'e', full_name: 'KONE Jean', email: null, phone: null }, // homonyme
];

describe('fiche du personnel d\'un compte', () => {
  it('par l\'e-mail, sans tenir compte des majuscules', () => {
    expect(trouverFiche({ nom: 'Autre nom', email: 'KOFFI@Ecole.bj' }, personnel)).toBe('a');
  });
  it('par le téléphone, ancien ou nouveau format du Bénin', () => {
    expect(trouverFiche({ nom: 'x', phone: '+229 01 97 00 00 02' }, personnel)).toBe('b');
    expect(trouverFiche({ nom: 'x', phone: '+22997000001' }, personnel)).toBe('a');
  });
  it('par le nom, sans accents ni ordre des mots', () => {
    expect(trouverFiche({ nom: 'Ismael MENSAH' }, personnel)).toBe('b');
    expect(trouverFiche({ nom: 'traore franck' }, personnel)).toBe('c');
  });
  it('l\'e-mail passe avant le nom', () => {
    expect(trouverFiche({ nom: 'MENSAH Ismaël', email: 'franck@ecole.bj' }, personnel)).toBe('c');
  });
  it('deux fiches pour un même nom : rien (jamais la fiche d\'un homonyme)', () => {
    expect(trouverFiche({ nom: 'KONE Jean' }, personnel)).toBeNull();
  });
  it('un homonyme est départagé par l\'e-mail ou le téléphone quand ils existent', () => {
    const liste = [{ id: 'k1', full_name: 'KONE Jean', email: 'k1@e.bj' }, { id: 'k2', full_name: 'KONE Jean', email: 'k2@e.bj' }];
    expect(trouverFiche({ nom: 'KONE Jean', email: 'k2@e.bj' }, liste)).toBe('k2');
  });
  it('aucune correspondance : null', () => {
    expect(trouverFiche({ nom: 'INCONNU Paul', email: 'p@e.bj', phone: '+22999999999' }, personnel)).toBeNull();
  });
  it('liste vide ou absente, personne sans nom : null, sans planter', () => {
    expect(trouverFiche({ nom: 'AGOSSOU Koffi' }, [])).toBeNull();
    expect(trouverFiche({ nom: 'AGOSSOU Koffi' }, null)).toBeNull();
    expect(trouverFiche({}, personnel)).toBeNull();
  });
  it('un fondateur sans fiche du personnel : pas de lien', () => {
    expect(trouverFiche({ nom: 'Céline Fondatrice', email: 'f@e.bj' }, personnel)).toBeNull();
  });
});

describe('lien enregistré (staff.profile_id)', () => {
  const liste = [
    { id: 'a', full_name: 'AGOSSOU Koffi', email: 'koffi@ecole.bj', phone: null, profile_id: 'u1' },
    { id: 'b', full_name: 'MENSAH Ismaël', email: null, phone: null, profile_id: null },
    { id: 'c', full_name: 'MENSAH Ismaël', email: null, phone: null, profile_id: 'u3' },
  ];
  it('le lien enregistré fait foi, même si l\'e-mail, le téléphone et le nom ne correspondent à rien', () => {
    expect(trouverFiche({ id: 'u1', nom: 'Un tout autre nom', email: 'autre@x.bj' }, liste)).toBe('a');
  });
  it('un compte relié à une fiche ne prend pas la fiche d\'un autre, même au même e-mail', () => {
    expect(trouverFiche({ id: 'u9', nom: 'Koffi A.', email: 'koffi@ecole.bj' }, liste)).toBeNull();
  });
  it('un compte pas encore relié retrouve sa fiche non reliée par le nom (les fiches reliées à d\'autres sont écartées : plus d\'homonymie)', () => {
    expect(trouverFiche({ id: 'u2', nom: 'Ismaël MENSAH' }, liste)).toBe('b');
  });
  it('sans lien enregistré nulle part (base pas à jour), on devine comme avant', () => {
    expect(trouverFiche({ id: 'u1', nom: 'AGOSSOU Koffi' }, [{ id: 'x', full_name: 'AGOSSOU Koffi' }])).toBe('x');
  });
});
