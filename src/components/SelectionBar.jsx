// Barre d'actions flottante affichée en bas de l'écran quand le mode
// sélection est actif (case à cocher sur chaque ligne à la place de
// l'icône supprimer) — cohérente sur toutes les listes qui proposent une
// sélection multiple (Élèves, Parents, Personnel).
//
// actionLabel/actionColor : "Supprimer" en rouge par défaut (Élèves,
// Parents, inchangé) — Personnel (Staff.jsx) passe "Archiver"/"Réactiver"
// en neutre, l'action derrière onDelete n'y étant plus une suppression.
export default function SelectionBar({ count, allSelected, onCancel, onToggleAll, onDelete, deleting, actionLabel = 'Supprimer', actionColor = 'var(--danger)', actionIcon }) {
  return (
    <div
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, zIndex: 25,
        display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderRadius: 30,
        background: 'var(--forest-dark)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      }}
      className="selection-bar"
    >
      <button type="button" onClick={onCancel} style={pillStyle()}>Annuler</button>
      <button type="button" onClick={onToggleAll} style={pillStyle(allSelected)}>Tout</button>
      <span style={{ minWidth: 22, textAlign: 'center', color: 'var(--gold)', fontWeight: 700, fontSize: 13.5 }}>{count}</span>
      <button
        type="button"
        onClick={onDelete}
        disabled={count === 0 || deleting}
        style={{ ...pillStyle(), display: 'flex', alignItems: 'center', gap: 6, color: '#fff', background: count === 0 ? 'rgba(255,255,255,0.08)' : actionColor, opacity: deleting ? 0.7 : 1 }}
      >
        {actionIcon || <TrashIcon />}
        {actionLabel}
      </button>
    </div>
  );
}

function pillStyle(active) {
  return {
    padding: '9px 16px', borderRadius: 24, border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', color: '#fff',
  };
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" />
      <path d="M10 11l0 6" />
      <path d="M14 11l0 6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}
