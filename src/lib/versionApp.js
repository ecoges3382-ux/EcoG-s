// Version de l'application : celle qui est installée sur cet appareil (figée à la compilation) face à celle qui est en ligne
// (le fichier /version.json, réécrit à chaque publication par `npm run build`). Cette comparaison ne dépend PAS du service worker :
// si le service worker rate une mise à jour, elle la voit quand même.
//
// Ce module garde aussi un petit état partagé (dernière vérification, signal reçu, état du canal temps réel) que la carte
// « Diagnostic des mises à jour » des Paramètres affiche.

// Remplacé à la compilation (vite.config.js). Hors compilation (tests, outils), la valeur est inconnue.
export const VERSION_INSTALLEE = typeof __BUILD_ID__ !== 'undefined' ? String(__BUILD_ID__) : null;

// Lit la version en ligne. Renvoie null si elle est illisible (hors connexion, fichier absent, page de secours renvoyée à la place).
export async function lireVersionEnLigne({ fetchFn = typeof fetch === 'function' ? fetch : null, maintenant = Date.now } = {}) {
  if (!fetchFn) return null;
  try {
    const reponse = await fetchFn(`/version.json?t=${maintenant()}`, { cache: 'no-store' });
    if (!reponse.ok) return null;
    const donnees = await reponse.json();
    const version = donnees && donnees.version;
    return typeof version === 'string' && version ? version : null;
  } catch {
    return null;
  }
}

// Vrai seulement quand les deux versions sont connues ET différentes : dans le doute (illisible), on ne dérange personne.
export function versionPerimee(installee, enLigne) {
  if (!installee || !enLigne) return false;
  return installee !== enLigne;
}

// « 20 nov. 2026, 14:03 » à partir de l'identifiant de version (un horodatage en millisecondes), sinon l'identifiant tel quel.
export function libelleVersion(version, locale = 'fr-FR') {
  if (!version) return 'inconnue';
  const n = Number(version);
  if (!Number.isFinite(n) || n < 1e12) return String(version);
  return new Date(n).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Dernier recours : désinscrit les service workers, vide les caches de l'application puis recharge la page. L'appareil repart
 * alors de zéro et reçoit la dernière version en ligne. Les données (connexion, réglages) ne sont pas touchées.
 */
export async function rechargementPropre({ nav = typeof navigator !== 'undefined' ? navigator : null, cachesApi = typeof caches !== 'undefined' ? caches : null, recharger = () => window.location.reload() } = {}) {
  try {
    if (nav && nav.serviceWorker && typeof nav.serviceWorker.getRegistrations === 'function') {
      const inscriptions = await nav.serviceWorker.getRegistrations();
      await Promise.all(inscriptions.map((i) => i.unregister()));
    }
  } catch { /* on recharge quand même */ }
  try {
    if (cachesApi && typeof cachesApi.keys === 'function') {
      const noms = await cachesApi.keys();
      await Promise.all(noms.map((n) => cachesApi.delete(n)));
    }
  } catch { /* on recharge quand même */ }
  recharger();
}

// Décrit l'état du service worker de cet appareil : 'aucun' | 'actif' | 'en attente' | 'installation' | 'inconnu'.
export async function etatServiceWorker(nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    if (!nav || !nav.serviceWorker || typeof nav.serviceWorker.getRegistration !== 'function') return 'inconnu';
    const i = await nav.serviceWorker.getRegistration();
    if (!i) return 'aucun';
    if (i.waiting) return 'en attente';
    if (i.installing) return 'installation';
    if (i.active) return 'actif';
    return 'inconnu';
  } catch {
    return 'inconnu';
  }
}

// ---- État partagé pour le diagnostic -------------------------------------------------------------------------------------

let etat = {
  derniereVerification: null, // heure (ms) de la dernière vérification
  versionEnLigne: null, // dernière version lue en ligne
  lectureEchouee: false,
  dernierSignal: null, // heure (ms) du dernier signal de déploiement reçu
  canal: 'non démarré', // SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED | 'désactivé' | 'non démarré'
};
const abonnes = new Set();

export const lireEtat = () => etat;
export function majEtat(partie) {
  etat = { ...etat, ...partie };
  abonnes.forEach((f) => f());
}
export function abonner(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

// La vérification « maintenant » est fournie par la bannière quand elle est montée ; le diagnostic l'appelle.
let verificationManuelle = null;
export function enregistrerVerification(f) {
  verificationManuelle = f;
  return () => { if (verificationManuelle === f) verificationManuelle = null; };
}
export async function verifierMaintenant() {
  if (!verificationManuelle) return false;
  return verificationManuelle();
}

// Vérifie la version en ligne et mémorise le résultat. Renvoie la version en ligne (ou null).
export async function controlerVersion(options) {
  const enLigne = await lireVersionEnLigne(options);
  majEtat({ derniereVerification: Date.now(), versionEnLigne: enLigne, lectureEchouee: enLigne === null });
  return enLigne;
}
