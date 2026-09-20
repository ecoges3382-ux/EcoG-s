// Calcule si un élève doit être relancé pour retard de paiement, à partir
// du calendrier de l'école (school_years.date_tranche1/2/3/connexe) et de
// ce qui a réellement été payé (enrollment.montant_paye/montant_du,
// frais_connexe_paye/du). Un seul endroit pour ce calcul, réutilisé par
// Élèves, Argent et le tableau de bord — au lieu de dupliquer la logique.
//
// Seuils cumulés, répartis également sur le nombre de délais réellement
// configurés (1, 2 ou 3) : avec les 3 dates renseignées, on attend ~1/3
// payé au 1er délai, ~2/3 au 2e, 100 % au 3e ; avec seulement 2 dates
// (école à 2 tranches), 50 % puis 100 % ; avec une seule date, 100 % à ce
// délai. On se base sur le montant réellement payé plutôt que sur les tags
// "tranche" saisis à la main sur chaque paiement individuel — pas assez
// homogènes pour être une source de vérité fiable.
export function computeRelance(enrollment, schoolYear) {
  if (enrollment?.note_arrangement?.trim()) {
    return { relance: false, moratoire: true, relanceEcolage: false, relanceConnexe: false };
  }
  if (!schoolYear) {
    return { relance: false, moratoire: false, relanceEcolage: false, relanceConnexe: false };
  }

  const today = new Date();
  const dates = [schoolYear.date_tranche1, schoolYear.date_tranche2, schoolYear.date_tranche3].filter(Boolean);
  // Seuils cumulés répartis également sur le nombre de dates réellement
  // configurées (1, 2 ou 3) : le dernier délai renseigné attend toujours
  // 100 %, quel que soit le nombre de tranches que l'école utilise.
  const seuils = dates.map((_, i) => (i + 1) / dates.length);
  const montantDu = Number(enrollment.montant_du) || 0;
  const ratio = montantDu > 0 ? Number(enrollment.montant_paye) / montantDu : 1;

  let relanceEcolage = false;
  dates.forEach((d, i) => {
    if (new Date(d) < today && ratio < seuils[i]) relanceEcolage = true;
  });

  const relanceConnexe = !!(
    schoolYear.date_connexe
    && new Date(schoolYear.date_connexe) < today
    && Number(enrollment.frais_connexe_paye) < Number(enrollment.frais_connexe_du)
  );

  return { relance: relanceEcolage || relanceConnexe, moratoire: false, relanceEcolage, relanceConnexe };
}
