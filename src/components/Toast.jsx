import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Confirmation visuelle unique pour toute l'app — jusqu'ici chaque écran
// gérait (ou pas) son propre message "Enregistré." en texte discret dans
// la page, sans rien de commun. Un seul petit bandeau flottant en bas de
// l'écran, déclenché par useToast() depuis n'importe quel composant,
// auto-masqué après quelques secondes. Ne remplace pas les messages
// d'erreur détaillés déjà affichés près de chaque formulaire — sert
// uniquement à confirmer un succès de façon visible et cohérente.
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(timerRef.current);
    clearTimeout(hideTimerRef.current);
    setToast({ message, type, visible: true });
    timerRef.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, visible: false } : t));
      hideTimerRef.current = setTimeout(() => setToast(null), 300);
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', left: '50%', bottom: 24, zIndex: 1000,
            transform: `translateX(-50%) translateY(${toast.visible ? '0' : '12px'})`,
            opacity: toast.visible ? 1 : 0,
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            display: 'flex', alignItems: 'center', gap: 9,
            background: toast.type === 'error' ? 'var(--danger)' : 'var(--forest-dark)',
            color: '#fff', padding: '12px 20px', borderRadius: 30,
            boxShadow: '0 10px 30px rgba(0,0,0,0.22)', fontSize: 13.5, fontWeight: 600,
            maxWidth: 'calc(100vw - 32px)', pointerEvents: 'none',
          }}
        >
          <i className={`ti ${toast.type === 'error' ? 'ti-x' : 'ti-check'}`} style={{ fontSize: 16 }} aria-hidden="true"></i>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// Toujours utilisable, même hors ToastProvider (ex. avant connexion) :
// retombe sur un no-op plutôt que de planter, pour ne jamais devenir un
// prérequis bloquant sur un écran qui n'aurait pas encore le provider.
export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || (() => {});
}
