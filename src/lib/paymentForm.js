// Règles communes aux deux formulaires d'encaissement (« Nouveau paiement » dans Argent, « Encaisser un paiement » sur la
// fiche élève) : quelles tranches proposer selon le type de frais, et le détail de ce qui est déjà payé.
import { TRANCHES } from './utils.js';
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
