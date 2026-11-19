// Écriture des notes et des moyennes : virgule décimale (français) partout. Le « /20 » est écrit à part : petit et grisé à
// l'écran (composant Sur20), en toutes lettres sur les bulletins (moyenneBulletin).

// 11,68 (nombre d'un nombre de décimales fixe)
export function virgule(n, decimales = 2) {
  return Number(n).toFixed(decimales).replace('.', ',');
}

// Une note telle qu'elle a été saisie : 14 → « 14 », 12.7 → « 12,7 » (pas de décimales ajoutées).
export function noteTexte(n) {
  return String(Number(n)).replace('.', ',');
}

// Une note avec son barème, en texte simple : « 14/20 », « 12,7/20 ». Barème absent ou illisible : la note seule.
export function noteAvecBareme(n) {
  const sur = Number(n.sur);
  return sur > 0 ? `${noteTexte(n.note)}/${sur}` : noteTexte(n.note);
}

// Sur un bulletin, on écrit normalement : « 14,50/20 ».
export function moyenneBulletin(m) {
  return m == null ? '—' : `${virgule(m, 2)}/20`;
}
