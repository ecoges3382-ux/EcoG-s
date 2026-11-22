// Interrupteur coulissant (gauche = désactivé, droite = activé), à la place d'une case à cocher. Accessible : c'est un bouton
// role="switch" (clavier : Espace ou Entrée), avec le texte comme nom.
export default function Interrupteur({ actif, onChange, label, disabled = false, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={actif}
      disabled={disabled}
      onClick={() => onChange(!actif)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: 0, background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, textAlign: 'left', opacity: disabled ? 0.6 : 1 }}
    >
      <span
        aria-hidden="true"
        style={{ position: 'relative', flexShrink: 0, width: 46, height: 26, borderRadius: 13, background: actif ? 'var(--forest)' : 'var(--line-strong)', transition: 'background .18s ease' }}
      >
        <span style={{ position: 'absolute', top: 3, left: actif ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .18s ease' }} />
      </span>
      <span>{label}{typeof actif === 'boolean' && <span style={{ marginLeft: 8, fontWeight: 700, color: actif ? 'var(--forest-text)' : 'var(--muted)' }}>{actif ? 'Activé' : 'Désactivé'}</span>}</span>
    </button>
  );
}
