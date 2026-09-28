import { useState } from 'react';
import { createPortal } from 'react-dom';

// Remplace <input type="date"> partout dans l'app : le contrôle natif du
// navigateur (surtout sur iOS Safari) ne respecte pas toujours l'alignement
// et l'espacement qu'on lui donne en CSS — un champ apparaissait mal centré
// sur téléphone alors que le code lui-même était parfaitement symétrique
// (vérifié). Ce composant dessine tout lui-même (bouton + calendrier),
// donc le rendu est garanti identique partout, sur tous les navigateurs.
// Valeurs manipulées en ISO ("aaaa-mm-jj", chaîne vide si aucune date) —
// même convention que l'ancien <input type="date">, donc aucun changement
// côté appelants au-delà du remplacement de la balise elle-même.

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePicker({ value, onChange, min, placeholder = 'jj/mm/aaaa', style, disabled, title }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseIso(value) || new Date());

  function openPicker() {
    if (disabled) return;
    setViewDate(parseIso(value) || new Date());
    setOpen(true);
  }

  const minDate = min ? parseIso(min) : null;
  const selected = parseIso(value);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // lundi = 0
  const cells = Array.from({ length: startWeekday }, () => null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  function selectDay(d) {
    const picked = new Date(year, month, d);
    if (minDate && picked < minDate) return;
    onChange(toIso(picked));
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        title={title}
        onClick={openPicker}
        disabled={disabled}
        style={{ ...triggerStyle, ...style, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'inherit' : 'var(--muted)' }}>
          {value ? parseIso(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}
        </span>
        <i className="ti ti-calendar" style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0, marginLeft: 8 }} aria-hidden="true"></i>
      </button>

      {open && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ background: 'var(--paper)', borderRadius: 16, width: '100%', maxWidth: 320, padding: 20, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={navBtnStyle} aria-label="Mois précédent">
                <i className="ti ti-chevron-left" style={{ fontSize: 17 }} aria-hidden="true"></i>
              </button>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{MOIS[month]} {year}</p>
              <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={navBtnStyle} aria-label="Mois suivant">
                <i className="ti ti-chevron-right" style={{ fontSize: 17 }} aria-hidden="true"></i>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
              {JOURS.map((j, i) => (
                <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{j}</span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 2 }}>
              {cells.map((d, i) => {
                if (d === null) return <span key={i} />;
                const cellDate = new Date(year, month, d);
                const isSelected = selected && sameDay(cellDate, selected);
                const isToday = sameDay(cellDate, new Date());
                const isDisabled = minDate && cellDate < minDate;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDay(d)}
                    style={{
                      aspectRatio: '1', border: isToday && !isSelected ? '1px solid var(--forest)' : 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: isSelected ? 700 : 500, margin: '1px 0',
                      background: isSelected ? 'var(--forest)' : 'transparent',
                      color: isDisabled ? 'var(--line-strong)' : isSelected ? '#fff' : 'var(--ink)',
                      cursor: isDisabled ? 'default' : 'pointer',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); }}
                  style={{ flex: 1, padding: '9px 14px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'none', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const triggerStyle = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'left', color: 'var(--ink)',
};

const navBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', borderRadius: 8 };
