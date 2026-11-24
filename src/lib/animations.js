// Animations de l'application : deux modes, « complet » et « réduit ».
//
// Le mode complet donne les effets de présentation (compteurs qui roulent, entrées en cascade, anneaux qui se remplissent, ouverture
// en « loupe »). Le mode réduit les supprime : l'application reste identique, sans mouvement. Il est choisi :
//   1) par la personne, dans Paramètres > Animations (« Complètes » ou « Réduites ») ;
//   2) sinon automatiquement : réduit si l'appareil demande moins de mouvement (réglage système), s'il est peu puissant
//      (2 Go de mémoire ou moins) ou s'il est en économie de données ; complet dans les autres cas.
// Le résultat est écrit sur <html data-anim="complet|reduit"> : le CSS et les composants s'y réfèrent.
import { useEffect, useState } from 'react';

export const CLE_REGLAGE = 'ecoges_animations';
export const REGLAGES = ['auto', 'complet', 'reduit'];
export const EASE_CSS = 'cubic-bezier(0.2, 0.8, 0.2, 1)'; // même courbe que la page d'accueil

// Décélération forte : le chiffre arrive vite puis se pose doucement.
export const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));

export function lireReglage(stockage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    const v = stockage?.getItem(CLE_REGLAGE);
    return REGLAGES.includes(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function ecrireReglage(valeur, stockage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    if (valeur === 'auto') stockage?.removeItem(CLE_REGLAGE);
    else if (REGLAGES.includes(valeur)) stockage?.setItem(CLE_REGLAGE, valeur);
  } catch { /* stockage indisponible : le réglage vaut pour cette visite seulement */ }
}

// Appareil peu puissant : 2 Go de mémoire ou moins (valeur arrondie par le navigateur), ou économie de données demandée.
export function appareilLent(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  if (nav.connection?.saveData === true) return true;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true;
  return false;
}

// Mode effectif à partir du réglage de la personne et de l'appareil. Un choix explicite l'emporte toujours sur l'automatique.
export function modeEffectif({ reglage = 'auto', mouvementReduit = false, lent = false } = {}) {
  if (reglage === 'complet') return 'complet';
  if (reglage === 'reduit') return 'reduit';
  return mouvementReduit || lent ? 'reduit' : 'complet';
}

export function calculerMode() {
  const mouvementReduit = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return modeEffectif({ reglage: lireReglage(), mouvementReduit, lent: appareilLent() });
}

const ECOUTEURS = new Set();

export function appliquerMode() {
  const mode = calculerMode();
  if (typeof document !== 'undefined') document.documentElement.dataset.anim = mode;
  ECOUTEURS.forEach((f) => f(mode));
  return mode;
}

// Appelée une fois au démarrage : applique le mode, puis le met à jour si le réglage système change.
export function demarrerAnimations() {
  appliquerMode();
  try { window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', appliquerMode); } catch { /* ancien navigateur */ }
}

export function choisirReglage(valeur) {
  ecrireReglage(valeur);
  return appliquerMode();
}

export function modeActuel() {
  if (typeof document === 'undefined') return 'complet';
  return document.documentElement.dataset.anim || calculerMode();
}

export function useModeAnimations() {
  const [mode, setMode] = useState(modeActuel);
  useEffect(() => {
    ECOUTEURS.add(setMode);
    setMode(modeActuel());
    return () => { ECOUTEURS.delete(setMode); };
  }, []);
  return mode;
}

/**
 * Décompose un texte déjà formaté (« 4 850 000 F CFA », « 78 % », « 14,62 / 20 ») en caractères : chaque chiffre devient une colonne qui
 * roule, tout le reste (espaces, virgules, lettres) reste fixe. `cle` est la position depuis la FIN du texte, pour que les colonnes
 * gardent leur place quand le nombre de chiffres change (999 devient 1 000).
 */
export function decouperTexte(texte) {
  const caracteres = Array.from(String(texte ?? ''));
  return caracteres.map((c, i) => ({
    c,
    chiffre: /^[0-9]$/.test(c) ? Number(c) : null,
    cle: caracteres.length - i,
  }));
}

// Position d'arrivée d'une colonne : la bande contient deux fois 0 à 9 ; on s'arrête sur le chiffre de la seconde série, après un tour complet.
export const positionCible = (chiffre) => 10 + chiffre;

// Position (0 à 19) pendant l'animation, de `depart` vers `cible`, p allant de 0 à 1.
export const positionEn = (depart, cible, p) => depart + (cible - depart) * easeOutExpo(p);
