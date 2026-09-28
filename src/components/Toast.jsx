import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Tracés SVG plutôt que la police d'icônes Tabler ("ti-check"/"ti-x") : même
// défaut de fiabilité en prod que ShieldIcon/HelpIcon dans Shell.jsx (icône
// manquante selon le navigateur) — inacceptable ici puisque c'est la seule
// confirmation visuelle qu'une action a bien été enregistrée.
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5l5 5L19.5 7" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

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
            transform: `translateX(-50%) translateY(${toast.visible ? '0' : '10px'}) scale(${toast.visible ? 1 : 0.92})`,
            opacity: toast.visible ? 1 : 0,
            transition: toast.visible
              ? 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'opacity 0.2s ease, transform 0.2s ease',
            display: 'flex', alignItems: 'center', gap: 9,
            background: toast.type === 'error' ? 'var(--danger)' : 'var(--forest-dark)',
            color: '#fff', padding: '12px 20px', borderRadius: 30,
            boxShadow: '0 10px 30px rgba(0,0,0,0.22)', fontSize: 13.5, fontWeight: 600,
            maxWidth: 'calc(100vw - 32px)', pointerEvents: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
            {toast.type === 'error' ? <XIcon /> : <CheckIcon />}
          </span>
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
