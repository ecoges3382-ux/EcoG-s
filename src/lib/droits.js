// Droits d'accès : qui peut voir l'argent de l'école (paiements, salaires, avances, dépenses, recouvrement).
// C'est la MÊME règle que la base de données (fonction SQL peut_voir_finances, voir supabase/restreindre_finances.sql) :
//   - le fondateur, le directeur et la secrétaire, par leur rôle ;
//   - toute autre personne (enseignant, censeur…) seulement si le fondateur lui a coché « Gestion financière (Argent) ».
// Quand l'application cache l'argent à quelqu'un, la base ne lui donne de toute façon rien à lire : on ne montre pas des zéros trompeurs.
export const ROLES_FINANCES = ['fondateur', 'directeur', 'secretaire'];

export function peutVoirFinances(profile) {
  if (!profile) return false;
  if (ROLES_FINANCES.includes(profile.role)) return true;
  return profile.permissions?.finance === true;
}

// Fiches du personnel : qui peut en ajouter, modifier ou supprimer. Même règle que la base (fonction SQL peut_gerer_personnel) :
// fondateur, directeur et secrétaire par leur rôle ; toute autre personne seulement si le fondateur lui a coché « Personnel ».
// (Tout le monde peut LIRE la liste : les écrans Classes, Matières et Emploi du temps affichent les noms des enseignants.)
export function peutGererPersonnel(profile) {
  if (!profile) return false;
  if (ROLES_FINANCES.includes(profile.role)) return true;
  return profile.permissions?.personnel === true;
}
