// src/lib/tours.js

// Chaque "tour" (visite guidée) est identifié par une clé.
// Les étapes pointent vers un attribut data-tour="..." qu'on ajoutera
// dans les pages (ex: data-tour="money-tabs").
export const TOURS = {
  money: {
    label: 'Argent',
    steps: [
      {
        target: 'money-tabs',
        title: 'Les 5 onglets de l\'argent',
        text: 'Écolage, frais connexes, paiements, dépenses et avances sur salaire. Chaque onglet a son propre tableau de bord.',
      },
      {
        target: 'money-kpis',
        title: 'Les 3 chiffres clés',
        text: 'Attendu, encaissé, reste à recouvrer. Ils se recalculent à chaque paiement enregistré.',
      },
      {
        target: 'money-add-payment',
        title: 'Encaisser un paiement',
        text: 'Le bouton qui enregistre tout : montant, tranche, mode. Un reçu imprimable est généré automatiquement.',
      },
      {
        target: 'money-list',
        title: 'Chaque élève, son solde',
        text: 'Clique sur un élève pour voir l\'historique complet. Un badge de statut t\'indique qui relancer en priorité.',
      },
    ],
  },
};

export function getTour(pageKey) {
  return TOURS[pageKey] || null;
}

export function hasSeenTour(pageKey, userId) {
  if (!userId) return false;
  return localStorage.getItem(`ecoges_tour_${pageKey}_${userId}`) === 'v1';
}

export function markTourSeen(pageKey, userId) {
  if (!userId) return;
  localStorage.setItem(`ecoges_tour_${pageKey}_${userId}`, 'v1');
}
