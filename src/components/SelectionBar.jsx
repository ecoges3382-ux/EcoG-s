import { createPortal } from 'react-dom';

export default function SelectionBar({ count, allSelected, onCancel, onToggleAll, onDelete, deleting, actionLabel = 'Supprimer', actionColor = 'var(--danger)', actionIcon }) {
  // On utilise createPortal pour attacher la barre directement au <body>.
  // Sans ça, elle est piégée par l'animation de transition de la page et
  // scrolle avec le contenu au lieu de rester fixée à l'écran.
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 24,
        zIndex: 9999, // Z-index très élevé pour passer au-dessus de tout
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 30,
        background: 'var(--forest-dark)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        color: '#fff',
        fontFamily: 'var(--sans)',
        maxWidth: '95vw',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
      className="selection-bar"
    >
      <button
        type="button"
        onClick={onCancel}
        style={{ padding: '8px 14px', borderRadius: 24, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
      >
        ANNULER
      </button>

      <button
        type="button"
        onClick={onToggleAll}
        style={{ padding: '8px 14px', borderRadius: 24, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
      >
        {allSelected ? 'AUCUN' : 'TOUT'}
      </button>

      <span style={{ minWidth: 24, textAlign: 'center', color: 'var(--gold)', fontWeight: 800, fontSize: 15 }}>
        {count}
      </span>

      <button
        type="button"
        onClick={onDelete}
        disabled={count === 0 || deleting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 24,
          border: 'none',
          fontSize: 12,
          fontWeight: 700,
          cursor: count === 0 || deleting ? 'default' : 'pointer',
          background: count === 0 ? 'rgba(255,255,255,0.05)' : actionColor,
          color: count === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
          letterSpacing: '0.04em',
          opacity: deleting ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {actionIcon ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{actionIcon}</span>
        ) : (
          <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true"></i>
        )}
        {deleting ? '...' : actionLabel.toUpperCase()}
      </button>
    </div>,
    document.body
  );
}
