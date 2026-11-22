// Création d'un compte de connexion : créer aussi, en un geste, la fiche du personnel de la personne (et la relier au compte).
// Sans cela, un compte n'a ni salaire, ni matière, ni page de personnel tant qu'on n'a pas ajouté sa fiche à la main.
import { splitFullName, displayName } from './utils.js';

// Rôle du compte -> rôle écrit sur la fiche du personnel (les fiches portent le libellé : « Secrétaire », « Enseignant »...).
export const ROLE_FICHE = { directeur: 'Directeur', censeur: 'Censeur', secretaire: 'Secrétaire', enseignant: 'Enseignant', fondateur: 'Fondateur' };
const PREFIXES = { Enseignant: 'ENS', Censeur: 'CEN', Secrétaire: 'SEC', Directeur: 'DIR', Fondateur: 'FON' };

// Matricule suivant pour un rôle de fiche : « SEC-0003 » s'il y a déjà deux secrétaires. Même règle que le formulaire du personnel.
export function nextMatricule(existingStaff, role) {
  const count = (existingStaff || []).filter((p) => p.role === role).length + 1;
  return `${PREFIXES[role] || 'PER'}-${String(count).padStart(4, '0')}`;
}

// Fiche à enregistrer pour un compte. Le nom est découpé comme dans le reste de l'application (mot en majuscules = nom de famille).
export function ficheDepuisCompte({ schoolId, profileId, fullName, role, email, phone, existingStaff }) {
  const roleFiche = ROLE_FICHE[role] || 'Enseignant';
  const { nom, prenom } = splitFullName(fullName);
  return {
    school_id: schoolId,
    profile_id: profileId,
    matricule: nextMatricule(existingStaff, roleFiche),
    full_name: displayName(nom, prenom) || String(fullName || '').trim(),
    nom,
    prenom,
    role: roleFiche,
    classes: [],
    phone: phone || '',
    email: email || '',
  };
}

/** Crée la fiche reliée au compte. Rend { ok: true } ou { ok: false, erreur }. Jamais bloquant pour l'appelant : le compte existe déjà. */
export async function creerFicheDepuisCompte(client, params) {
  const { data: existants } = await client.from('staff').select('role');
  const { error } = await client.from('staff').insert(ficheDepuisCompte({ ...params, existingStaff: existants || [] }));
  return error ? { ok: false, erreur: error } : { ok: true };
}
