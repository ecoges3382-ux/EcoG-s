import { useEffect } from 'react';

export default function GuidedTour() {
  // On définit la fonction de lancement de la visite
  const startTour = () => {
    if (!window.driver) {
      alert("La librairie de visite (Driver.js) n'est pas chargée. Vérifie ta connexion internet.");
      return;
    }

    const isMobile = window.innerWidth < 768;

    const steps = isMobile ? [
      {
        element: '#bottomnav a[href="/eleves"]',
        popover: { title: 'Gérer les élèves', description: 'Inscrire un nouvel élève et consulter les fiches.', side: 'top', align: 'center' }
      },
      {
        element: '#bottomnav a[href="/recouvrement"]',
        popover: { title: 'Le Recouvrement', description: 'Voir qui doit payer et les relances.', side: 'top', align: 'center' }
      }
    ] : [
      {
        element: '#sidebar',
        popover: { title: 'Le menu principal', description: 'Naviguez entre les sections.', side: 'right', align: 'start' }
      },
      {
        element: '#sidebar a[href="/eleves"]',
        popover: { title: 'Gérer les élèves', description: 'Inscrire un élève ou importer un fichier.', side: 'right', align: 'start' }
      }
    ];

    const driverObj = window.driver.js.driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'C\'est parti !',
      steps: steps,
      onDestroyed: () => {
        try { localStorage.setItem('ecoges_has_seen_tour', 'true'); } catch (e) {}
      }
    });

    driverObj.drive();
  };

  useEffect(() => {
    // On expose la fonction globalement pour pouvoir l'appeler depuis les Paramètres
    window.startEcogesTour = startTour;

    try {
      const hasSeenTour = localStorage.getItem('ecoges_has_seen_tour');
      if (!hasSeenTour) {
        // Lancement automatique après 3 secondes
        setTimeout(startTour, 3000);
      }
    } catch (e) {
      console.warn('localStorage inaccessible', e);
    }
  }, []);

  return null;
}
