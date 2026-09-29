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
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

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
  // Panneau affiché à la place de la grille des jours : null (les jours),
  // 'month' (12 mois à toucher) ou 'year' (champ où taper l'année). Pour une
  // date de naissance, feuilleter mois par mois jusqu'à 2015 serait
  // interminable ; ces deux raccourcis y vont en un ou deux gestes.
  const [panel, setPanel] = useState(null);
  const [yearText, setYearText] = useState('');
  const [yearError, setYearError] = useState(false);

  function openPicker() {
    if (disabled) return;
    setViewDate(parseIso(value) || new Date());
    setPanel(null);
    setOpen(true);
  }

  function togglePanel(name) {
    setYearText('');
    setYearError(false);
    setPanel((cur) => (cur === name ? null : name));
  }

  function pickMonth(m) {
    setViewDate(new Date(viewDate.getFullYear(), m, 1));
    setPanel(null);
  }

  function applyYear(text) {
    const n = Number(text);
    if (text.length !== 4 || n < YEAR_MIN || n > YEAR_MAX) {
      setYearError(true);
      return;
    }
    setViewDate(new Date(n, viewDate.getMonth(), 1));
    setYearError(false);
    setPanel(null);
  }

  function onYearInput(e) {
    const text = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYearText(text);
    setYearError(false);
    // Quatre chiffres tapés = année complète : on l'applique tout de suite,
    // sans obliger à chercher un bouton de validation avec le clavier ouvert.
    if (text.length === 4) applyYear(text);
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
              <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ ...navBtnStyle, visibility: panel ? 'hidden' : 'visible' }} aria-label="Mois précédent">
                <i className="ti ti-chevron-left" style={{ fontSize: 17 }} aria-hidden="true"></i>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button type="button" onClick={() => togglePanel('month')} aria-expanded={panel === 'month'} aria-label={`Choisir le mois, actuellement ${MOIS[month]}`} style={titleBtnStyle(panel === 'month')}>
                  {MOIS[month]}
                  <i className="ti ti-chevron-down" style={{ fontSize: 12, marginLeft: 3 }} aria-hidden="true"></i>
                </button>
                <button type="button" onClick={() => togglePanel('year')} aria-expanded={panel === 'year'} aria-label={`Choisir l'année, actuellement ${year}`} style={titleBtnStyle(panel === 'year')}>
                  {year}
                  <i className="ti ti-chevron-down" style={{ fontSize: 12, marginLeft: 3 }} aria-hidden="true"></i>
                </button>
              </div>
              <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ ...navBtnStyle, visibility: panel ? 'hidden' : 'visible' }} aria-label="Mois suivant">
                <i className="ti ti-chevron-right" style={{ fontSize: 17 }} aria-hidden="true"></i>
              </button>
            </div>

            <div style={{ minHeight: 268 }}>
            {panel === 'month' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {MOIS.map((nom, i) => (
                  <button
                    key={nom}
                    type="button"
                    onClick={() => pickMonth(i)}
                    style={{
                      padding: '14px 4px', borderRadius: 10, fontSize: 13.5, fontWeight: i === month ? 700 : 500, cursor: 'pointer',
                      border: `1px solid ${i === month ? 'var(--forest)' : 'var(--line-strong)'}`,
                      background: i === month ? 'var(--forest)' : 'var(--paper)', color: i === month ? '#fff' : 'var(--ink)',
                    }}
                  >
                    {nom}
                  </button>
                ))}
              </div>
            )}

            {panel === 'year' && (
              <div style={{ paddingTop: 24, textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>Tape l'année (par exemple {year})</p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  maxLength={4}
                  value={yearText}
                  onChange={onYearInput}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyYear(yearText); } }}
                  placeholder={String(year)}
                  aria-label="Année"
                  aria-invalid={yearError}
                  style={{ width: 150, padding: '12px 14px', borderRadius: 10, border: `1px solid ${yearError ? 'var(--danger)' : 'var(--line-strong)'}`, fontSize: 22, fontWeight: 600, textAlign: 'center', letterSpacing: '0.08em', boxSizing: 'border-box', color: 'var(--ink)', fontFamily: 'inherit' }}
                />
                <p style={{ margin: '10px 0 0', minHeight: 18, fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
                  {yearError ? `Une année entre ${YEAR_MIN} et ${YEAR_MAX}.` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => applyYear(yearText)}
                  style={{ marginTop: 4, padding: '10px 22px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Valider
                </button>
              </div>
            )}

            {!panel && (
              <>

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
              </>
            )}
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

const titleBtnStyle = (active) => ({
  display: 'flex', alignItems: 'center', padding: '6px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, color: 'var(--ink)',
  background: active ? 'var(--forest-light)' : 'transparent',
});

const navBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', borderRadius: 8 };
