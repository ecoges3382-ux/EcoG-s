import { useEffect, useRef, useState } from 'react';

// Remplace <select> partout dans l'app par un menu qui s'ouvre en accordéon
// juste sous le champ (jamais en survol flottant, pour ne jamais reproduire
// le bug de recadrage déjà rencontré avec les menus position:absolute — voir
// le correctif sur les menus contextuels de Comptes/Accès parents) : coche
// verte sur l'option sélectionnée, liste déroulante scrollable si longue.
export default function Dropdown({ value, onChange, options, placeholder = 'Choisir…', label, style, wrapperStyle, disabled, className, title, textColor, chevronColor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = normalized.find((o) => o.value === value);

  return (
    <div ref={ref} className={className} style={{ width: '100%', ...wrapperStyle }}>
      {label && <label style={labelStyle}>{label}</label>}
      <button
        type="button"
        title={title}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        style={{ ...triggerStyle, ...style, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: textColor || (selected ? 'var(--ink)' : 'var(--muted)') }}>
          {selected ? selected.label : placeholder}
        </span>
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 15, flexShrink: 0, color: chevronColor || 'var(--muted)', marginLeft: 8 }} aria-hidden="true"></i>
      </button>

      {open && (
        <div style={listStyle}>
          {normalized.map((o, i) => {
            const active = o.value === value;
            return (
              <div
                key={o.value}
                role="button"
                tabIndex={0}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ ...itemStyle, borderBottom: i < normalized.length - 1 ? '1px solid var(--line)' : 'none', color: active ? 'var(--forest)' : 'var(--ink)', fontWeight: active ? 700 : 500 }}
              >
                <i className="ti ti-check" style={{ fontSize: 14, color: 'var(--forest)', visibility: active ? 'visible' : 'hidden', flexShrink: 0 }} aria-hidden="true"></i>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              </div>
            );
          })}
          {normalized.length === 0 && <p style={{ margin: 0, padding: '10px 14px', fontSize: 12.5, color: 'var(--muted)' }}>Aucune option.</p>}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5 };

const triggerStyle = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)',
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'left',
};

const listStyle = {
  marginTop: 6, border: '1px solid var(--line-strong)', borderRadius: 10, background: 'var(--paper)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: 260, overflowY: 'auto',
};

const itemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13.5, cursor: 'pointer',
};
