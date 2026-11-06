import { createPortal } from 'react-dom';

export default function ParentCodesView({ result, copied, copyLink, onCreated }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', padding: 26, textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Élève inscrit</p>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          {result.secondCode ? 'Deux codes d\'accès parent ont été générés.' : 'Code d\'accès du parent — à lui transmettre.'}
        </p>
        {result.code && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parent 1</p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.1em', background: 'var(--forest-light)', color: 'var(--forest-dark)', padding: '10px', borderRadius: 10 }}>{result.code}</p>
          </div>
        )}
        {result.secondCode && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parent 2</p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.1em', background: 'var(--forest-light)', color: 'var(--forest-dark)', padding: '10px', borderRadius: 10 }}>{result.secondCode}</p>
          </div>
        )}
        {result.code && (
          <button type="button" onClick={copyLink} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px', marginBottom: 10 }}>{copied ? 'Lien copié !' : 'Copier le lien du parent 1'}</button>
        )}
        <button type="button" onClick={onCreated} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px' }}>Terminé</button>
      </div>
    </div>,
    document.body
  );
}
