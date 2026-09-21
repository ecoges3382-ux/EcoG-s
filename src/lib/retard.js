import { TRANCHES } from './utils.js';

// Source unique pour tout calcul lié aux échéances de paiement d'un élève
// (Élèves, Argent, fiche élève, Dashboard) — au lieu de dupliquer la
// logique. computeRelance() est un dérivé de computeEcheances() : jamais
// deux calculs indépendants du même "reste à payer".
//
// Répartition des échéances de scolarité : si la grille tarifaire du
// niveau de l'élève (fee_schedules, montant_tranche1/2/3) est configurée,
// les seuils cumulés utilisent les PROPORTIONS de cette grille, remises à
// l'échelle du montant_du réel de l'élève (qui peut différer de la grille :
// bourse, réduction saisie à la main sur l'inscription). Une tranche à 0
// dans la grille (ex. école à 2 tranches) n'est jamais affichée comme une
// échéance à part — elle n'existe simplement pas pour ce niveau. Si la
// grille n'est pas configurée du tout, repli sur une répartition en parts
// égales du montant_du — comportement historique, pour ne rien casser chez
// une école qui n'a pas encore rempli sa grille par tranche.
//
// Chaque paiement encaissé se répartit en cascade sur les échéances dans
// l'ordre (1ère tranche d'abord, l'excédent vers la 2e, etc.) — c'est ce
// qui permet à un paiement supérieur au montant d'une échéance de couvrir
// automatiquement le début de la suivante, sans règle spéciale à part.
function trancheSlots(montantDu, feeSchedule, nbDelais) {
  const bruts = [
    Number(feeSchedule?.montant_tranche1) || 0,
    Number(feeSchedule?.montant_tranche2) || 0,
    Number(feeSchedule?.montant_tranche3) || 0,
  ];
  const totalBrut = bruts[0] + bruts[1] + bruts[2];
  const du = Number(montantDu) || 0;

  if (totalBrut > 0) {
    const actifs = [0, 1, 2].filter((i) => bruts[i] > 0);
    const montants = actifs.map((i) => Math.round((bruts[i] / totalBrut) * du));
    const ecart = du - montants.reduce((a, v) => a + v, 0);
    montants[montants.length - 1] += ecart; // dernière tranche active absorbe l'arrondi
    return actifs.map((slotIndex, k) => ({ slotIndex, montant: montants[k] }));
  }

  // Pas de grille par tranche pour ce niveau : répartition en parts égales
  // sur le nombre de délais que l'école a effectivement configurés dans
  // son calendrier (au moins 1, pour toujours avoir une échéance même sans
  // calendrier rempli).
  const n = Math.max(nbDelais, 1);
  const part = Math.round(du / n);
  return Array.from({ length: n }, (_, k) => ({
    slotIndex: k,
    montant: k === n - 1 ? du - part * (n - 1) : part,
  }));
}

// Retourne la liste des échéances de scolarité + une échéance "Frais
// connexes" si elle s'applique. Chaque échéance : { id, label, ordre,
// montant, dateLimite, montantPaye, montantRestant, statut, enRetard }.
// statut ('payee' | 'partielle' | 'impayee') dépend uniquement des
// paiements réellement enregistrés, jamais de la date — enRetard est la
// seule chose que la date influence (délai dépassé ET pas encore soldée).
export function computeEcheances(enrollment, schoolYear, feeSchedule) {
  if (!schoolYear || !enrollment) return [];
  const today = new Date();
  const montantDu = Number(enrollment.montant_du) || 0;
  const montantPayeTotal = Number(enrollment.montant_paye) || 0;

  const datesConfigurees = [schoolYear.date_tranche1, schoolYear.date_tranche2, schoolYear.date_tranche3];
  const nbDelais = datesConfigurees.filter(Boolean).length;
  const slots = trancheSlots(montantDu, feeSchedule, nbDelais);

  let cumulAvant = 0;
  const echeancesScolarite = slots.map(({ slotIndex, montant }, k) => {
    const montantPaye = Math.min(Math.max(montantPayeTotal - cumulAvant, 0), montant);
    const statut = montant <= 0 ? 'payee' : montantPaye >= montant ? 'payee' : montantPaye > 0 ? 'partielle' : 'impayee';
    const dateLimite = datesConfigurees[slotIndex] || null;
    const enRetard = statut !== 'payee' && !!dateLimite && new Date(dateLimite) < today;
    cumulAvant += montant;
    return {
      id: `tranche${slotIndex + 1}`,
      label: TRANCHES.find((t) => t.id === `tranche${slotIndex + 1}`)?.label || `Échéance ${k + 1}`,
      ordre: k + 1,
      montant,
      dateLimite,
      montantPaye,
      montantRestant: Math.max(montant - montantPaye, 0),
      statut,
      enRetard,
    };
  });

  const echeances = [...echeancesScolarite];
  if (schoolYear.date_connexe || Number(enrollment.frais_connexe_du) > 0) {
    const montant = Number(enrollment.frais_connexe_du) || 0;
    const montantPaye = Math.min(Number(enrollment.frais_connexe_paye) || 0, montant);
    const statut = montant <= 0 ? 'payee' : montantPaye >= montant ? 'payee' : montantPaye > 0 ? 'partielle' : 'impayee';
    const enRetard = statut !== 'payee' && !!schoolYear.date_connexe && new Date(schoolYear.date_connexe) < today;
    echeances.push({
      id: 'connexe',
      label: 'Frais connexes',
      ordre: echeancesScolarite.length + 1,
      montant,
      dateLimite: schoolYear.date_connexe || null,
      montantPaye,
      montantRestant: Math.max(montant - montantPaye, 0),
      statut,
      enRetard,
    });
  }

  return echeances;
}

// Un parent qui a négocié un arrangement (ex. payer par mensualités plutôt
// que suivre les tranches) est exclu des relances automatiques tant que
// cette note existe. Sans calendrier configuré du tout (aucune date de
// tranche ni de frais connexes), on ne peut rien dater : pas de relance
// automatique, l'ancien badge par pourcentage prend le relais côté écran
// (voir Students.jsx).
export function computeRelance(enrollment, schoolYear, feeSchedule) {
  if (enrollment?.note_arrangement?.trim()) {
    return { relance: false, moratoire: true, relanceEcolage: false, relanceConnexe: false };
  }
  if (!schoolYear) {
    return { relance: false, moratoire: false, relanceEcolage: false, relanceConnexe: false };
  }

  const echeances = computeEcheances(enrollment, schoolYear, feeSchedule);
  const relanceEcolage = echeances.some((e) => e.id !== 'connexe' && e.enRetard);
  const relanceConnexe = echeances.some((e) => e.id === 'connexe' && e.enRetard);

  return { relance: relanceEcolage || relanceConnexe, moratoire: false, relanceEcolage, relanceConnexe };
}
