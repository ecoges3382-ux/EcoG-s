import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Remplace window.confirm() partout dans l'app : la boîte native du
// navigateur ne peut pas être stylée, bloque le fil JS et jure avec le
// reste de l'interface. useConfirm() renvoie une fonction qui affiche cette
// boîte de dialogue et résout une Promise<boolean> une fois la personne
// répondue — même usage qu'un window.confirm() classique, juste "await"
// devant (tous les appelants sont déjà dans des fonctions async).
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        message,
        confirmLabel: options.confirmLabel || 'Confirmer',
        cancelLabel: options.cancelLabel || 'Annuler',
        danger: options.danger ?? true,
      });
    });
  }, []);

  function settle(result) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }

  // Garde le même clavier que window.confirm() (Entrée = confirmer,
  // Échap = annuler) pour ne pas retirer une habitude déjà acquise.
  useEffect(() => {
    if (!state) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          role="alertdialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) settle(false); }}
        >
          <div className="confirm-dialog-in" style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 400, width: '100%', padding: 24, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.45)' }}>
            <p style={{ margin: '0 0 22px', fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.6 }}>{state.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => settle(false)} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>
                {state.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                autoFocus
                style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: state.danger ? 'var(--danger)' : 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px' }}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé sous ConfirmProvider');
  return ctx;
}
