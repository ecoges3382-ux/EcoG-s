// Bouton « palette » de la barre du haut : chaque utilisateur choisit SA couleur d'application, sans toucher à celle des autres.
// `couleur` : sa couleur personnelle (ou null), `couleurEcole` : celle de l'école (utilisée tant qu'il n'a rien choisi),
// `onChoisir(hex | null)` : null = revenir à la couleur de l'école.
import { useEffect, useRef, useState } from 'react';
import { COULEURS_PROPOSEES, couleurLisible } from '../lib/theme.js';

function PaletteIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-3.9-4-7.2-9-7.2z" />
      <circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" />
    </svg>
  );
}

export default function ChoixCouleur({ couleur, couleurEcole, onChoisir }) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef(null);

  // Se ferme quand on clique ailleurs ou qu'on appuie sur Échap.
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => { if (racine.current && !racine.current.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('pointerdown', dehors); document.removeEventListener('keydown', echap); };
  }, [ouvert]);

  const active = (couleur || '').toLowerCase();
  const estProposee = COULEURS_PROPOSEES.some((c) => (couleurLisible(c.hex) || c.hex).toLowerCase() === active);

  return (
    <div ref={racine} className="choix-couleur">
      <button type="button" onClick={() => setOuvert((v) => !v)} className="topbar-action-btn" title="Choisir ma couleur" aria-haspopup="dialog" aria-expanded={ouvert}>
        <PaletteIcon />
      </button>
      {ouvert && (
        <div role="dialog" aria-label="Ma couleur" className="choix-couleur-panneau">
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Ma couleur</p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Ce choix ne concerne que toi : les autres gardent la leur.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            {COULEURS_PROPOSEES.map((c) => {
              const choisie = (couleurLisible(c.hex) || c.hex).toLowerCase() === active;
              return (
                <button key={c.hex} type="button" onClick={() => onChoisir(c.hex)} title={c.nom} aria-label={c.nom} aria-pressed={choisie}
                  style={{ width: 42, height: 42, borderRadius: '50%', border: choisie ? '3px solid var(--ink)' : '3px solid transparent', outline: '1px solid var(--line-strong)', background: c.hex, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 0, justifySelf: 'center' }}>
                  {choisie && <i className="ti ti-check" style={{ fontSize: 16 }} aria-hidden="true"></i>}
                </button>
              );
            })}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', marginBottom: 12 }}>
            <input type="color" value={active && !estProposee ? active : '#0f4c3a'} onChange={(e) => onChoisir(e.target.value)}
              style={{ width: 42, height: 34, borderRadius: 9, border: '1px solid var(--line-strong)', padding: 2, cursor: 'pointer', background: 'var(--paper)' }} />
            Une autre couleur
          </label>

          <button type="button" onClick={() => onChoisir(null)} disabled={!couleur}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 13, cursor: couleur ? 'pointer' : 'default', opacity: couleur ? 1 : 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {couleurEcole && <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', background: couleurEcole, border: '1px solid var(--line-strong)' }}></span>}
            Couleur de l'école
          </button>
        </div>
      )}
    </div>
  );
}
