// Recherche de texte pour les listes (élèves, matières…) : sans tenir compte des majuscules ni des accents, et dans
// n'importe quel ordre des mots (« jean keita » trouve « KEITA Jean »). Utile sur téléphone, où l'on saisit rarement les accents.
export function sansAccents(texte) {
  return String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Vrai si TOUS les mots de la recherche se trouvent dans le texte. Une recherche vide correspond à tout.
export function correspondAuxMots(texte, recherche) {
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const cible = sansAccents(texte);
  return mots.every((mot) => cible.includes(mot));
}
