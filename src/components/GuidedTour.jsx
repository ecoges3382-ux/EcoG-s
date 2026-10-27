import { useEffect } from 'react';

export default function GuidedTour() {
  useEffect(() => {
    // 1. On entoure le localStorage d'un try/catch (Safari en navigation privée le bloque parfois)
    try {
      const hasSeenTour = localStorage.getItem('ecoges_has_seen_tour');
      if (hasSeenTour) return;
    } catch (e) {
      console.warn('localStorage non disponible', e);
    }

    // 2. On attend 3 secondes pour être sûr que l'écran est bien chargé sur mobile
    const timer = setTimeout(() => {
      if (!window.driver) return;

      // 3. On détecte si on est sur un petit écran (mobile)
      const isMobile = window.innerWidth < 768;

      // 4. On prépare les étapes selon l'appareil
      const steps = isMobile ? [
        {
          element: '#bottomnav a[href="/eleves"]',
          popover: {
            title: 'Gérer les élèves',
            description: 'Cliquez ici pour inscrire un nouvel élève et consulter les fiches.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#bottomnav a[href="/recouvrement"]',
          popover: {
            title: 'Le Recouvrement',
            description: 'Voir qui doit payer, qui est en retard, et les relances à faire.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#bottomnav a[href="/parametres"]',
          popover: {
            title: 'Les Paramètres',
            description: 'Configurez votre école et la grille tarifaire.',
            side: 'top',
            align: 'center'
          }
        }
      ] : [
        {
          element: '#sidebar',
          popover: {
            title: 'Le menu principal',
            description: 'C\'est ici que vous naviguerez entre les sections de l\'école.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '#sidebar a[href="/eleves"]',
          popover: {
            title: 'Gérer les élèves',
            description: 'Inscrire un nouvel élève, consulter les fiches, ou importer un fichier Excel.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '#sidebar a[href="/recouvrement"]',
          popover: {
            title: 'Le Recouvrement',
            description: 'Voir qui doit payer, qui est en retard, et les relances.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '#sidebar a[href="/parametres"]',
          popover: {
            title: 'Les Paramètres',
            description: 'Configurez votre école, la grille tarifaire, et votre équipe.',
            side: 'right',
            align: 'start'
          }
        }
      ];

      const driverObj = window.driver.js.driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayOpacity: 0.6,
        nextBtnText: 'Suivant',
        prevBtnText: 'Précédent',
        doneBtnText: 'C\'est parti !',
        steps: steps,
        onDestroyed: () => {
          try {
            localStorage.setItem('ecoges_has_seen_tour', 'true');
          } catch (e) {
            // Ignore si le stockage est bloqué
          }
        }
      });

      driverObj.drive();
    }, 3000); // 3 secondes d'attente

    return () => clearTimeout(timer);
  }, []);

  return null;
}
