import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function GuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);

  // Les étapes de la visite
  const getSteps = () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      return [
        { id: 'bottomnav a[href="/eleves"]', title: 'Les Élèves', text: 'Cliquez ici pour inscrire un nouvel élève et voir sa fiche.' },
        { id: 'bottomnav a[href="/recouvrement"]', title: 'Le Recouvrement', text: 'Suivez ici les paiements et repérez les retards en un clin d\'œil.' },
        { id: 'bottomnav a[href="/parametres"]', title: 'Les Paramètres', text: 'C\'est ici que vous configurez l\'école, les tarifs et votre équipe.' }
      ];
    }
    return [
      { id: '#sidebar', title: 'Le Menu', text: 'Bienvenue sur EcoGès ! Utilisez ce menu pour naviguer entre les différentes sections de l\'école.' },
      { id: '#sidebar a[href="/eleves"]', title: 'Les Élèves', text: 'Inscrivez de nouveaux élèves, consultez leurs fiches, ou importez une liste Excel en un clic.' },
      { id: '#sidebar a[href="/recouvrement"]', title: 'Le Recouvrement', text: 'Voyez qui doit payer, qui est en retard, et envoyez des relances automatiquement.' },
      { id: '#sidebar a[href="/parametres"]', title: 'Les Paramètres', text: 'Configurez les tarifs, le calendrier et invitez votre personnel.' }
    ];
  };

  const steps = getSteps();

  // Fonction pour démarrer
  const startTour = () => {
    setStepIndex(0);
    setIsActive(true);
  };

  // Exposition de la fonction au niveau global pour le bouton
  useEffect(() => {
    window.startEcogesTour = startTour;
    // Lancement auto au premier chargement
    const hasSeen = localStorage.getItem('ecoges_seen_tour_v2');
    if (!hasSeen) {
      setTimeout(() => { window.startEcogesTour(); }, 2000);
    }
  }, []);

  // À chaque changement d'étape, on calcule la position de l'élément ciblé
  useEffect(() => {
    if (!isActive) return;
    
    const step = steps[stepIndex];
    if (!step) {
      // Fin de la visite
      setIsActive(false);
      localStorage.setItem('ecoges_seen_tour_v2', 'true');
      return;
    }

    const element = document.querySelector(step.id);
    if (element) {
      const updateRect = () => {
        const r = element.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      };
      updateRect();
      // Recalculer si l'écran change de taille
      window.addEventListener('resize', updateRect);
      return () => window.removeEventListener('resize', updateRect);
    } else {
      // Si l'élément n'est pas trouvé (ex: menu caché), on passe à l'étape suivante
      setStepIndex(prev => prev + 1);
    }
  }, [isActive, stepIndex, steps]);

  if (!isActive || !rect) return null;

  const currentStep = steps[stepIndex];
  if (!currentStep) return null;

  // Calcul de la position de la bulle de texte (à droite sur PC, au-dessus sur mobile)
  const isMobile = window.innerWidth < 768;
  const popoverStyle = isMobile 
    ? { left: '50%', transform: 'translateX(-50%)', bottom: rect.height + 30 + 'px', width: '90vw', maxWidth: 320 } 
    : { left: (rect.width + 20) + 'px', top: 0, width: 300 };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none' }}>
      
      {/* L'effet de "projecteur" (ombre géante qui assombrit tout sauf l'élément ciblé) */}
      <div style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
        borderRadius: 8,
        transition: 'all 0.3s ease',
        pointerEvents: 'none',
        zIndex: 100000
      }} />

      {/* La bulle explicative */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 'auto' : rect.top - 10,
        ...popoverStyle,
        background: 'var(--paper)',
        padding: '16px 20px',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
        zIndex: 100001,
        transition: 'all 0.3s ease'
      }}>
        <h4 style={{ margin: '0 0 6px', fontSize: 16, fontFamily: 'var(--serif)', color: 'var(--ink)' }}>{currentStep.title}</h4>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{currentStep.text}</p>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>{stepIndex + 1} / {steps.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => { setIsActive(false); localStorage.setItem('ecoges_seen_tour_v2', 'true'); }}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Passer
            </button>
            <button 
              onClick={() => setStepIndex(prev => prev + 1)}
              style={{ background: 'var(--forest)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {stepIndex === steps.length - 1 ? 'Terminer' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
