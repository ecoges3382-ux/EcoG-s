import { Link } from 'react-router-dom';

// État vide générique pour un premier écran (aucune classe, aucun élève…) —
// remplace un simple <p> gris par une icône, un message et, si l'action a
// un sens depuis cet écran, un bouton pour la faire tout de suite. `icon`
// est un tracé SVG local à l'appelant (voir Students.jsx, Classes.jsx… :
// mêmes conventions que PencilIcon/TrashIcon déjà présents dans ces
// fichiers), jamais une police d'icônes — voir ShieldIcon dans Shell.jsx
// pour le pourquoi (glyphes manquants en prod selon le navigateur).
export default function EmptyState({ icon, title, subtitle, actionLabel, actionTo, onAction }) {
  return (
    <div className="empty-state-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '52px 24px', maxWidth: 380, margin: '0 auto' }}>
      {icon && (
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--forest-light)', color: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <p style={{ margin: '0 0 7px', fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
      {subtitle && (
        <p style={{ margin: actionLabel ? '0 0 20px' : 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{subtitle}</p>
      )}
      {actionLabel && actionTo && (
        <Link to={actionTo} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', textDecoration: 'none' }}>
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} style={{ fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
