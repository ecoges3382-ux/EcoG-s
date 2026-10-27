// Ce fichier traduit les erreurs techniques (anglais, codes SQL) 
// en messages clairs et rassurants pour l'utilisateur.

export function translateError(error) {
  if (!error) return 'Une erreur est survenue.';

  const msg = error.message || error.toString() || '';
  const code = error.code;

  // 1. Problèmes de réseau
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
    return "Oups, la connexion internet semble coupée. Vérifie ton réseau et réessaie.";
  }

  // 2. Doublons (ex: classe qui existe déjà, email déjà pris, code en double)
  if (code === '23505' || msg.includes('duplicate key value')) {
    return "Cet élément existe déjà dans le système. Par exemple, un autre élève a peut-être déjà ce matricule, ou cette classe porte déjà ce nom.";
  }

  // 3. Suppression bloquée (ex: supprimer une classe qui a des élèves)
  if (code === '23503' || msg.includes('violates foreign key constraint')) {
    return "Impossible de supprimer cet élément : il est encore utilisé ailleurs dans l'application (par exemple, des élèves y sont encore rattachés).";
  }

  // 4. Session expirée (JWT)
  if (msg.includes('JWT expired') || code === 'PGRST301') {
    return "Ta session a expiré pour des raisons de sécurité. Reconnecte-toi pour continuer.";
  }

  // 5. Mauvais mot de passe
  if (msg.includes('Invalid login credentials')) {
    return "Identifiant ou mot de passe incorrect. Vérifie tes informations.";
  }

  // 6. Email non confirmé
  if (msg.includes('Email not confirmed')) {
    return "Ton adresse e-mail n'est pas encore confirmée. Vérifie ta boîte mail (et tes spams) pour cliquer sur le lien d'activation.";
  }

  // 7. Permission refusée (RLS)
  if (code === '42501' || msg.includes('row-level security')) {
    return "Tu n'as pas les droits nécessaires pour effectuer cette action. Contacte ton administrateur.";
  }

  // 8. Valeur trop longue
  if (code === '22001' || msg.includes('value too long')) {
    return "Le texte saisi est trop long pour ce champ. Essaie de le raccourcir.";
  }

  // Si l'erreur n'est pas reconnue, on renvoie le message d'origine
  // (mais on préfixe avec un texte rassurant)
  return `Une erreur technique est survenue : ${msg}`;
}
