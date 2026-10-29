import { createPortal } from 'react-dom';
import { useEffect } from 'react';

export function useLockBodyScroll() {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
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

export default function ModalContainer({
  onClose,
  children,
  maxWidth = 480,
  maxHeight = '90vh',
  zIndex = 50,
  padded = true,
  align = 'center',
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
        alignItems: align === 'top' ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: align === 'top' ? '5vh 20px' : (padded ? 20 : 0),
        overflowY: 'auto',
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
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
