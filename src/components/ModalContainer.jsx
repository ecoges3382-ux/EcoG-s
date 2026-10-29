import { createPortal } from 'react-dom';
import { useEffect } from 'react';

// Verrouille le scroll du body tant qu'une modal est ouverte. Évite que
// la page en arrière-plan continue à scroller pendant qu'on interagit
// avec la modal (problème particulièrement visible sur iOS).
export function useLockBodyScroll() {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    // Compense la disparition de la scrollbar pour éviter un saut horizontal
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);
}

// Conteneur de modal réutilisable partout dans l'app. Gère :
// - Le portail vers document.body (échappe aux contextes d'empilement)
// - Le verrouillage du scroll de la page en arrière-plan
// - Le scroll interne indépendant (overscroll-behavior: contain)
// - La fermeture par clic sur le fond
// - La fermeture par touche Échap
export default function ModalContainer({
  onClose,
  children,
  maxWidth = 480,
  maxHeight = '90vh',
  zIndex = 50,
  padded = true,
}) {
  useLockBodyScroll();

  useEffect(() => {
    if (!onClose) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: padded ? 20 : 0,
        // Scroll externe : si la modal est plus haute que l'écran, on peut
        // scroller sur le fond pour atteindre les bords
        overflowY: 'auto',
        // Empêche le scroll de se propager à la page derrière (iOS/Safari)
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          background: 'var(--paper)',
          borderRadius: 16,
          maxWidth,
          width: '100%',
          maxHeight,
          // Scroll interne indépendant de celui du body
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          // Marge en bas sur mobile pour ne jamais être masqué par la
          // bottom nav (sur desktop, marge réduite)
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
