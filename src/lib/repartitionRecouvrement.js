// Page Recouvrement, graphique « Répartition des élèves » : chaque élève est dans UN seul groupe.
//
//   Payé en totalité            : plus rien à payer (écolage et frais connexes) ;
//   En retard                   : une échéance est dépassée (qu'il ait déjà payé une partie ou non) ;
//   Partiel, dans les délais    : il reste un solde, aucune échéance dépassée, et il a déjà payé une partie ;
//   Rien payé, dans les délais  : il reste un solde, aucune échéance dépassée, et il n'a encore rien payé.
//
// « Dans les délais » regroupe aussi les élèves sous moratoire, et tous ceux qui ont un solde quand le calendrier de paiement
// n'est pas configuré (on ne peut alors dire de personne qu'il est en retard).
// Chaque élève : { statutKey, montant_paye, frais_connexe_paye } (statutKey vient de la page Recouvrement).
const STATUTS_AVEC_SOLDE_A_LA_DATE = ['dans_les_delais', 'solde_restant', 'moratoire', 'moratoire_expirant'];

export function repartitionEleves(eleves) {
  const r = { payes: 0, partiels: 0, rienPaye: 0, enRetard: 0, enRetardAvecPaiement: 0 };
  for (const s of eleves || []) {
    const aPayeUnePartie = (Number(s.montant_paye) || 0) + (Number(s.frais_connexe_paye) || 0) > 0;
    if (s.statutKey === 'a_jour') r.payes += 1;
    else if (s.statutKey === 'a_relancer') { r.enRetard += 1; if (aPayeUnePartie) r.enRetardAvecPaiement += 1; }
    else if (STATUTS_AVEC_SOLDE_A_LA_DATE.includes(s.statutKey)) { if (aPayeUnePartie) r.partiels += 1; else r.rienPaye += 1; }
  }
  return r;
}
