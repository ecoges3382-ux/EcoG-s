// Mise à jour de l'application : quand chercher une nouvelle version, et comment réagir au signal « une version vient d'être
// déployée ». Le nom du canal et de l'événement sont partagés avec le workflow GitHub qui envoie le signal
// (.github/workflows/prevenir-mise-a-jour.yml) : un test vérifie qu'ils restent identiques des deux côtés.

export const CANAL_VERSION = 'app-version';
export const EVENEMENT_DEPLOIEMENT = 'deploy';

// Vérification régulière quand l'application est ouverte et visible.
export const DELAI_VERIFICATION = 60 * 1000;
// Deux vérifications ne se suivent jamais de plus près (retour au premier plan + réseau qui revient arrivent souvent ensemble).
export const ECART_MINIMUM = 5 * 1000;
// « Plus tard » : la bannière revient après ce délai si la mise à jour attend toujours.
export const DELAI_RAPPEL = 10 * 60 * 1000;
// Après un signal de déploiement : on cherche tout de suite, puis deux fois encore (le réseau de diffusion des fichiers peut
// mettre quelques secondes à servir la nouvelle version partout).
export const DELAIS_APRES_SIGNAL = [0, 8 * 1000, 20 * 1000];

/**
 * Crée la fonction qui va chercher une nouvelle version.
 *  - donneInscription() : l'inscription du service worker (null tant qu'elle n'existe pas) ;
 *  - controlerVersion() : optionnel, lit la version en ligne (indépendant du service worker) ;
 *  - maintenant() : l'heure (injectable pour les tests).
 * `verifier({ force })` ne fait rien si une vérification vient d'avoir lieu (sauf force) ; ne lève jamais d'erreur (hors
 * connexion, la vérification échoue simplement : elle sera retentée).
 */
export function creerVerificateur({ donneInscription, controlerVersion = null, maintenant = Date.now, ecartMinimum = ECART_MINIMUM }) {
  let derniere = -Infinity;
  return async function verifier({ force = false } = {}) {
    const inscription = donneInscription();
    const peutMettreAJour = Boolean(inscription) && typeof inscription.update === 'function';
    if (!peutMettreAJour && !controlerVersion) return false;
    const t = maintenant();
    if (!force && t - derniere < ecartMinimum) return false;
    derniere = t;
    // Deux contrôles indépendants : le service worker (qui peut rater une mise à jour) et la lecture directe de la version en
    // ligne (qui ne dépend de personne). L'échec de l'un n'empêche pas l'autre.
    const resultats = await Promise.all([
      peutMettreAJour ? Promise.resolve().then(() => inscription.update()).then(() => true, () => false) : false,
      controlerVersion ? Promise.resolve().then(() => controlerVersion()).then(() => true, () => false) : false,
    ]);
    return resultats.some(Boolean);
  };
}

// Vérifications planifiées après un signal de déploiement : renvoie la fonction qui annule celles qui n'ont pas encore eu lieu.
export function planifierApresSignal(verifier, { delais = DELAIS_APRES_SIGNAL, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const minuteries = delais.map((d) => setTimer(() => verifier({ force: d === 0 }), d));
  return () => minuteries.forEach((m) => clearTimer(m));
}

// Vrai si un service worker est DÉJÀ inscrit sur cet appareil (par exemple parce que le personnel y a ouvert l'application). Sert
// au portail parent : on n'inscrit rien chez les parents qui n'en ont pas (téléchargement de ~2,5 Mo), mais là où il existe déjà,
// il sert une ancienne copie du site tant qu'on ne l'a pas mis à jour.
export async function serviceWorkerDejaInscrit(nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    if (!nav || !nav.serviceWorker || typeof nav.serviceWorker.getRegistration !== 'function') return false;
    return Boolean(await nav.serviceWorker.getRegistration());
  } catch {
    return false;
  }
}
