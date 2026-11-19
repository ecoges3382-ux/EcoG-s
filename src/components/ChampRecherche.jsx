// Cadre de recherche pour une liste : loupe, bouton d'effacement, la touche Entrée ne valide pas le formulaire qui le contient.
export default function ChampRecherche({ value, onChange, placeholder, label, dataTour, style, inputStyle }) {
  return (
    <div data-tour={dataTour} style={{ position: 'relative', ...style }}>
      <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--muted)', pointerEvents: 'none' }} aria-hidden="true"></i>
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        placeholder={placeholder}
        aria-label={label || placeholder}
        autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 38px 10px 36px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 14, color: 'var(--ink)', background: 'var(--paper)', marginBottom: 0, ...inputStyle }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche" title="Effacer"
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: '4px 8px' }}>×</button>
      )}
    </div>
  );
}
