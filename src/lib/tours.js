// src/lib/tours.js

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
        target: 'money-list',
        title: 'Chaque élève, son solde',
        text: 'Clique sur un élève pour voir l\'historique complet. Un badge de statut t\'indique qui relancer en priorité.',
      },
    ],
  },

  recouvrement: {
    label: 'Recouvrement',
    steps: [
      {
        target: 'recouvrement-kpis',
        title: 'Ce qui est attendu, ce qui est rentré',
        text: 'Trois blocs : écolage, inscription, frais connexes. Chacun a son propre taux de recouvrement.',
      },
      {
        target: 'recouvrement-priority',
        title: 'Qui relancer en priorité',
        text: 'Les élèves avec le plus gros solde et le plus en retard, classés automatiquement.',
      },
      {
        target: 'recouvrement-filters',
        title: 'Filtrer par situation',
        text: 'À jour, à relancer, dans les délais, en moratoire — clique pour n\'afficher qu\'un type d\'élève.',
      },
      {
        target: 'recouvrement-synthese',
        title: 'La synthèse globale',
        text: 'En bas de page : le total écolage + connexes additionné, pour la vue comptable.',
      },
    ],
  },

  notes: {
    label: 'Notes',
    steps: [
      {
        target: 'notes-filters',
        title: 'Filtrer les notes',
        text: 'Choisis une classe, puis un élève ou une matière précise. Chaque filtre restreint les suivants.',
      },
      {
        target: 'notes-periods',
        title: 'Un trimestre à la fois',
        text: 'Interrogations, devoirs et examens du trimestre sélectionné seulement. « Tous » pour tout mélanger.',
      },
      {
        target: 'notes-list',
        title: 'Les notes saisies',
        text: 'Groupées par type (interrogations, devoirs, examens). Clique sur une note pour la modifier.',
      },
      {
        target: 'notes-rank',
        title: 'Le classement',
        text: 'Visible quand aucun élève n\'est sélectionné : tous les élèves de la classe classés par moyenne.',
      },
    ],
  },

  grades: {
    label: 'Bulletins',
    steps: [
      {
        target: 'grades-selectors',
        title: 'Choisir un bulletin',
        text: 'Classe, élève, période : le bulletin se reconstruit à chaque changement.',
      },
      {
        target: 'grades-print',
        title: 'Imprimer / PDF',
        text: 'Génère un bulletin prêt à imprimer, avec en-tête d\'école et cachet.',
      },
      {
        target: 'grades-sheet',
        title: 'Le bulletin',
        text: 'Moyennes par matière, pondérées par coefficient. Les notes manquantes affichent « — », jamais 0.',
      },
      {
        target: 'grades-summary',
        title: 'Moyenne et rang',
        text: 'Moyenne générale de l\'élève et son rang dans la classe. Calculé sur la période sélectionnée.',
      },
    ],
  },

  eleves: {
    label: 'Élèves',
    steps: [
      {
        target: 'students-actions',
        title: 'Ajouter ou importer des élèves',
        text: 'Trois façons : un élève à la fois, un fichier Excel/CSV existant, ou télécharger un modèle pour préparer l\'import.',
      },
      {
        target: 'students-filters',
        title: 'Filtrer par classe',
        text: '« Toutes » affiche tout l\'effectif. Choisis une classe pour ne voir que ses élèves.',
      },
      {
        target: 'students-list',
        title: 'La liste des élèves',
        text: 'Clique sur un élève pour ouvrir sa fiche complète. La colonne « Reste » et le badge de statut te disent qui a un solde.',
      },
    ],
  },

  personnel: {
    label: 'Personnel',
    steps: [
      {
        target: 'staff-actions',
        title: 'Ajouter un membre du personnel',
        text: 'Enseignants, secrétaires, directeurs — chacun avec son rôle et ses classes. Export CSV aussi disponible.',
      },
      {
        target: 'staff-tabs',
        title: 'Actifs et archivés',
        text: 'Les personnes qui ont quitté l\'école sont archivées, jamais supprimées — leur historique (salaires, avances) reste intact.',
      },
      {
        target: 'staff-list',
        title: 'La fiche de chaque personne',
        text: 'Clique sur une ligne pour ouvrir la fiche : salaire, avances, matières attribuées. La colonne Salaire t\'alerte si un montant manque.',
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
