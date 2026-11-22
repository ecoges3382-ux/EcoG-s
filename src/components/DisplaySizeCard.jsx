// Réglage « Taille d'affichage » : deux boutons − et +, par pas de 10 %, propre à l'appareil. Voir src/lib/zoom.js.
import { useState } from 'react';
import {
  ZOOM_DEFAULT, ZOOM_MIN, ZOOM_STEP, getZoom, saveZoom, applyZoom, maxZoomForScreen, supportsViewportZoom,
} from '../lib/zoom.js';

// Gros boutons ronds (zone tactile confortable) ; grisés aux limites.
const boutonZoom = (inactif) => ({
  width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--line-strong)', fontSize: 26, fontWeight: 700, lineHeight: 1,
  background: inactif ? 'var(--line)' : 'var(--forest-light)', color: inactif ? 'var(--muted)' : 'var(--forest-dark-text)', cursor: inactif ? 'default' : 'pointer',
});

export default function DisplaySizeCard() {
  const max = maxZoomForScreen();
  const [applied, setApplied] = useState(() => getZoom());
  const tactile = supportsViewportZoom();

  // Chaque appui sur − ou + applique tout de suite le nouveau zoom (jamais en dehors des bornes).
  function commit(demande) {
    const value = Math.min(max, Math.max(ZOOM_MIN, demande));
    if (value === applied) return;
    const largeurAvant = window.innerWidth;
    saveZoom(value);
    applyZoom(value);
    setApplied(value);
    // Si le navigateur n'a pas pris en compte le changement à chaud, un rechargement l'applique à coup sûr.
    setTimeout(() => {
      if (Math.abs(window.innerWidth - largeurAvant) < 2) window.location.reload();
    }, 450);
  }

  const reglable = max > ZOOM_MIN && tactile;

  return (
    <div className="card-bold" style={{ padding: '16px 20px' }}>
      <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>Taille d'affichage</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        {reglable
          ? "Agrandis ou réduis tout l'affichage de l'application. Ce réglage est propre à cet appareil."
          : "Sur ordinateur, utilise Ctrl et + pour agrandir, Ctrl et − pour réduire (Cmd sur Mac). Les boutons − et + apparaissent sur téléphone et tablette."}
      </p>

      {reglable && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={() => commit(applied - ZOOM_STEP)}
              disabled={applied <= ZOOM_MIN}
              aria-label="Réduire l'affichage"
              style={boutonZoom(applied <= ZOOM_MIN)}
            >
              −
            </button>
            <span style={{ minWidth: 64, textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }} aria-live="polite">{applied} %</span>
            <button
              type="button"
              onClick={() => commit(applied + ZOOM_STEP)}
              disabled={applied >= max}
              aria-label="Agrandir l'affichage"
              style={boutonZoom(applied >= max)}
            >
              +
            </button>
            {applied !== ZOOM_DEFAULT && (
              <button
                type="button"
                onClick={() => commit(ZOOM_DEFAULT)}
                style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
              >
                Revenir à 100 %
              </button>
            )}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Entre {ZOOM_MIN} % et {max} %, par pas de {ZOOM_STEP} %.</p>
        </>
      )}
    </div>
  );
}
