// Règles communes aux deux formulaires d'encaissement (« Nouveau paiement » dans Argent, « Encaisser un paiement » sur la
// fiche élève) : quelles tranches proposer selon le type de frais, et le détail de ce qui est déjà payé.
import { TRANCHES, fmtF } from './utils.js';
import { computeEcheances } from './retard.js';

// Seul l'écolage (« scolarité ») se paie en 1ère, 2ème, 3ème tranche ou par moitié. Les frais connexes, l'inscription et
// les autres frais se paient en une fois (« Complet ») ou pour un montant libre (« Autre »).
export function tranchesPourType(typeFrais) {
  if (typeFrais === 'scolarite') return TRANCHES;
  return TRANCHES.filter((t) => t.id === 'complet' || t.id === 'autre');
}

export function trancheValidePourType(typeFrais, tranche) {
  return tranchesPourType(typeFrais).some((t) => t.id === tranche);
}

// Quand on change de type de frais, la tranche choisie doit rester permise ; sinon on revient à « Complet ».
export function trancheApresChangementDeType(nouveauType, trancheActuelle) {
  return trancheValidePourType(nouveauType, trancheActuelle) ? trancheActuelle : 'complet';
}

// Détail de ce qui est déjà payé, tranche par tranche.
// Les paiements d'écolage remplissent les tranches dans l'ordre (la 1ère d'abord, puis la 2ème…), exactement comme
// l'échéancier de la fiche élève : c'est la même fonction (computeEcheances) qui calcule les deux.
export function detailEncaissements(eleve, anneeScolaire, grilleFrais) {
  if (!eleve || !anneeScolaire) return { echeances: [], prochaine: null, tropPercu: 0 };
  // Une tranche de 0 F n'a rien à encaisser : on ne l'affiche pas.
  const echeances = computeEcheances(eleve, anneeScolaire, grilleFrais).filter((e) => e.montant > 0);
  const prochaine = echeances.find((e) => e.statut !== 'payee')?.id || null;
  const tropPercu = Math.max((Number(eleve.montant_paye) || 0) - (Number(eleve.montant_du) || 0), 0);
  return { echeances, prochaine, tropPercu };
}

// ---------------------------------------------------------------------------------------------------------------------
// Choix proposés dans « Tranche / Type », avec le montant qui correspond à chacun, d'après ce que l'élève a DÉJÀ payé.
//
//  * une tranche d'écolage déjà soldée n'est plus proposée ;
//  * une tranche payée en partie propose son RESTE (« 2ème tranche (reste 27.000 F CFA) »), jamais son montant entier ;
//  * « Moitié » n'a de sens que tant que rien n'a été payé ;
//  * « Complet » (tout le dû) n'a de sens que tant que rien n'a été payé. Dès qu'il y a un paiement, il est remplacé par
//    « Solde (reste X) » : payer d'un coup tout ce qui reste. Même règle pour les frais connexes.
// Chaque choix : { id, label, montant } ; montant est null quand il se saisit à la main (« Autre »).
// ---------------------------------------------------------------------------------------------------------------------
const CHOIX_AUTRE = { id: 'autre', label: 'Autre', montant: null };
const entier = (n) => Math.round(Number(n) || 0);

function choixCompletOuSolde(du, paye) {
  const reste = Math.max(du - paye, 0);
  if (reste <= 0) return null; // tout est payé : plus rien à solder
  return paye > 0
    ? { id: 'complet', label: `Solde (reste ${fmtF(reste)})`, montant: reste }
    : { id: 'complet', label: 'Complet', montant: du };
}

// Liste d'origine, utilisée tant que l'année scolaire n'est pas chargée (ou qu'aucune tranche n'est définie).
function choixSansEcheancier(eleve, grilleFrais) {
  const scolarite = Number(eleve?.montant_du) || Number(grilleFrais?.montant_scolarite) || 0;
  const montants = {
    tranche1: Number(grilleFrais?.montant_tranche1) || 0,
    tranche2: Number(grilleFrais?.montant_tranche2) || 0,
    tranche3: Number(grilleFrais?.montant_tranche3) || 0,
    moitie: scolarite / 2,
    complet: scolarite,
  };
  return TRANCHES.map((t) => ({ id: t.id, label: t.label, montant: t.id === 'autre' ? null : (montants[t.id] || null) }));
}

export function optionsPaiement(typeFrais, eleve, anneeScolaire, grilleFrais) {
  if (typeFrais === 'scolarite') {
    const du = Number(eleve?.montant_du) || 0;
    const paye = Number(eleve?.montant_paye) || 0;
    const { echeances } = detailEncaissements(eleve, anneeScolaire, grilleFrais);
    const tranches = echeances.filter((e) => e.id.startsWith('tranche'));
    if (tranches.length === 0) return choixSansEcheancier(eleve, grilleFrais);

    const choix = tranches
      .filter((t) => t.statut !== 'payee')
      .map((t) => ({ id: t.id, label: t.montantPaye > 0 ? `${t.label} (reste ${fmtF(t.montantRestant)})` : t.label, montant: t.montantRestant }));
    if (paye <= 0 && du > 0) choix.push({ id: 'moitie', label: 'Moitié', montant: du / 2 });
    const complet = choixCompletOuSolde(du, paye);
    if (complet) choix.push(complet);
    choix.push(CHOIX_AUTRE);
    return choix;
  }

  if (typeFrais === 'connexe') {
    const du = Number(eleve?.frais_connexe_du) || 0;
    if (du <= 0) {
      // Pas de montant connexe enregistré pour l'élève : on propose celui de la grille tarifaire, comme avant.
      const grille = Number(grilleFrais?.montant_connexe) || 0;
      return [{ id: 'complet', label: 'Complet', montant: grille || null }, CHOIX_AUTRE];
    }
    const complet = choixCompletOuSolde(du, Number(eleve?.frais_connexe_paye) || 0);
    return complet ? [complet, CHOIX_AUTRE] : [CHOIX_AUTRE];
  }

  if (typeFrais === 'inscription') {
    const montant = Number(grilleFrais?.montant_inscription || grilleFrais?.montant_reinscription) || 0;
    return [{ id: 'complet', label: 'Complet', montant: montant || null }, CHOIX_AUTRE];
  }

  return [{ id: 'complet', label: 'Complet', montant: null }, CHOIX_AUTRE]; // « Autre » type de frais : montant libre
}

// Montant à pré-remplir pour le choix sélectionné (null : on ne touche pas au champ, ou il se saisit à la main).
export function montantPropose(choix, trancheId) {
  const c = choix.find((x) => x.id === trancheId);
  const m = c ? entier(c.montant) : 0;
  return m > 0 ? m : null;
}

// Le choix sélectionné doit toujours exister dans la liste : sinon « Complet » (ou « Solde ») s'il y est, sinon le premier.
export function choisirTranche(choix, actuelle) {
  if (choix.some((c) => c.id === actuelle)) return actuelle;
  return choix.some((c) => c.id === 'complet') ? 'complet' : (choix[0]?.id || 'autre');
}

// De combien le montant saisi dépasse ce qui reste dû (0 si pas de dépassement, ou si le type n'a pas de reste suivi).
export function depassement(typeFrais, montant, eleve) {
  const m = Number(montant) || 0;
  let reste = null;
  if (typeFrais === 'scolarite') reste = (Number(eleve?.montant_du) || 0) - (Number(eleve?.montant_paye) || 0);
  else if (typeFrais === 'connexe') reste = (Number(eleve?.frais_connexe_du) || 0) - (Number(eleve?.frais_connexe_paye) || 0);
  if (reste === null || reste <= 0) return 0; // tout payé : l'écran le signale déjà
  return m > reste ? m - reste : 0;
}
