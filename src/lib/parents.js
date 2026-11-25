// Parents : repérer un parent déjà enregistré avant d'en créer un deuxième (même nom ET même numéro).
import { sansAccents } from './texte.js';

// Les 8 derniers chiffres d'un numéro : « +229 97 70 31 54 » (ancien format) et « +229 01 97 70 31 54 » (depuis la réforme
// béninoise du 30 novembre 2024) désignent la même personne.
export function cleNumero(phone) {
  const chiffres = String(phone || '').replace(/\D/g, '');
  return chiffres.length >= 8 ? chiffres.slice(-8) : '';
}

// Les mots du nom, sans accents, dans l'ordre alphabétique : « Ina KEITA » et « KEITA Ina » sont le même nom.
export function cleNom(nom, prenom) {
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

// Clé de nom d'un parent déjà enregistré : nom + prénom s'ils existent, sinon le nom complet.
function cleNomParent(p) {
  return p.nom || p.prenom ? cleNom(p.nom, p.prenom) : cleNom(p.full_name, '');
}

const nbEnfants = (p) => (p.parent_access_students || []).length;

/**
 * Le parent à garder dans un groupe de doublons : celui qui a le plus d'enfants rattachés, à égalité le plus ancien (c'est lui dont
 * le lien d'accès circule déjà le plus), à égalité l'identifiant le plus petit (résultat stable).
 */
export function parentAGarder(membres) {
  return [...membres].sort((a, b) =>
    nbEnfants(b) - nbEnfants(a)
    || String(a.created_at || '9999').localeCompare(String(b.created_at || '9999'))
    || String(a.id).localeCompare(String(b.id)),
  )[0];
}

/**
 * Doublons déjà enregistrés : des parents de même nom ET de même numéro (comme pour l'alerte à la création). Sans numéro, jamais de
 * rapprochement. Renvoie des groupes { cle, membres, conseille } (au moins deux parents), triés par nom ; `conseille` = id à garder.
 */
export function grouperDoublonsParents(parents) {
  const groupes = new Map();
  for (const p of parents || []) {
    const numero = cleNumero(p.phone);
    const nom = cleNomParent(p);
    if (!numero || !nom) continue;
    const cle = `${nom}|${numero}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(p);
  }
  return [...groupes.entries()]
    .filter(([, membres]) => membres.length > 1)
    .map(([cle, membres]) => ({ cle, membres, conseille: parentAGarder(membres).id }))
    .sort((a, b) => a.cle.localeCompare(b.cle));
}

/**
 * Recherche dans la liste des parents : par nom ou par numéro, sans tenir compte des majuscules ni des accents, dans n'importe quel ordre
 * des mots. Un numéro se retrouve quelle que soit sa mise en forme (« 97 70 31 54 », « +229 01 97 70 31 54 », « 97703154 »).
 * Une recherche vide correspond à tous les parents.
 */
export function parentCorrespond(parent, recherche) {
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const texte = sansAccents(`${parent.full_name || ''} ${parent.nom || ''} ${parent.prenom || ''}`);
  const chiffres = String(parent.phone || '').replace(/\D/g, '');
  return mots.every((mot) => {
    if (texte.includes(mot)) return true;
    const chiffresMot = mot.replace(/\D/g, '');
    return chiffresMot.length >= 2 && /^[\d+]+$/.test(mot) && chiffres.includes(chiffresMot);
  });
}

// Filtres de la page Parents : tous, sans numéro (aucun rappel WhatsApp possible), ou avec plusieurs enfants.
export const FILTRES_PARENTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'sans_numero', label: 'Sans numéro' },
  { id: 'plusieurs_enfants', label: 'Plusieurs enfants' },
];

export function parentDansFiltre(parent, filtre) {
  if (filtre === 'sans_numero') return !String(parent.phone || '').replace(/\D/g, '');
  if (filtre === 'plusieurs_enfants') return (parent.parent_access_students || []).length > 1;
  return true;
}
