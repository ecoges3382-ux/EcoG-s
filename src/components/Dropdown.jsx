import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Remplace <select> partout dans l'app. Le panneau s'ouvre par-dessus le
// reste de la page (portail vers document.body, position:fixed ancrée sous
// le bouton), jamais en poussant le contenu qui suit vers le bas — c'était
// le comportement d'origine (accordéon en flux normal), changé après retour
// terrain : sur un écran déjà chargé (bulletin, formulaire…), pousser tout
// le contenu en dessous à chaque ouverture rendait la page instable et
// donnait une impression peu soignée. Le portail règle par la même
// occasion l'ancien bug de recadrage qui avait motivé le choix du flux
// normal (menu position:absolute coupé par un ancêtre overflow:hidden,
// voir Comptes/Accès parents) : un portail échappe entièrement à n'importe
// quel ancêtre, plus de recadrage possible. Coche verte sur l'option
// sélectionnée, liste déroulante scrollable si longue.
export default function Dropdown({ value, onChange, options, placeholder = 'Choisir…', label, style, wrapperStyle, disabled, className, title, textColor, chevronColor }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  // Position calculée à l'ouverture (juste sous le bouton, même largeur
  // mini que lui) — un portail n'hérite d'aucune position par le flux
  // normal, il faut la lui donner explicitement.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapperRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    // Le panneau étant ancré (pas repositionné en continu), un défilement
    // pendant qu'il est ouvert le décalerait de son bouton — plus simple et
    // plus prévisible de le refermer, comme la plupart des menus flottants.
    function handleScrollOrResize() { setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = normalized.find((o) => o.value === value);

  return (
    <div ref={wrapperRef} className={className} style={{ width: '100%', ...wrapperStyle }}>
      {label && <label style={labelStyle}>{label}</label>}
      <button
        ref={triggerRef}
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

      {open && coords && createPortal(
        <div
          ref={listRef}
          style={{
            ...listStyle,
            position: 'fixed', top: coords.top, left: coords.left,
            // width: max-content + minWidth : le panneau s'adapte à son
            // propre contenu au lieu d'hériter bêtement de la largeur du
            // bouton fermé — utile quand ce dernier est volontairement
            // compact (ex. le sélecteur d'année scolaire dans la barre du
            // haut, qui doit rester étroit une fois refermé).
            width: 'max-content', minWidth: coords.width, maxWidth: 280,
          }}
        >
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
        </div>,
        document.body
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
  zIndex: 50, border: '1px solid var(--line-strong)', borderRadius: 10, background: 'var(--paper)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxHeight: 260, overflowY: 'auto',
};

const itemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13.5, cursor: 'pointer',
};
