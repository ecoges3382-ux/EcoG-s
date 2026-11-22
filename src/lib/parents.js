// Parents : repérer un parent déjà enregistré avant d'en créer un deuxième (même nom ET même numéro).
import { sansAccents } from './texte.js';

// Les 8 derniers chiffres d'un numéro : « +229 97 70 31 54 » (ancien format) et « +229 01 97 70 31 54 » (depuis la réforme
// béninoise du 30 novembre 2024) désignent la même personne.
export function cleNumero(phone) {
  const chiffres = String(phone || '').replace(/\D/g, '');
  return chiffres.length >= 8 ? chiffres.slice(-8) : '';
}

// Les mots du nom, sans accents, dans l'ordre alphabétique : « Ina KEITA » et « KEITA Ina » sont le même nom.
function cleNom(nom, prenom) {
  return sansAccents(`${nom || ''} ${prenom || ''}`).split(/[\s'-]+/).filter(Boolean).sort().join(' ');
}

/**
 * Parents déjà enregistrés qui ressemblent à celui qu'on s'apprête à créer : même nom et même numéro.
 * `parents` : liste { id, nom, prenom, full_name, phone }. Sans numéro saisi, on ne propose rien (trop de risque de confondre
 * deux personnes qui portent le même nom).
 */
export function trouverDoublonsParent(parents, { nom, prenom, phone }) {
  const cle = cleNumero(phone);
  const nomCle = cleNom(nom, prenom);
  if (!cle || !nomCle) return [];
  return (parents || []).filter((p) => {
    if (cleNumero(p.phone) !== cle) return false;
    const existant = p.nom || p.prenom ? cleNom(p.nom, p.prenom) : cleNom(p.full_name, '');
    return existant === nomCle;
  });
}
