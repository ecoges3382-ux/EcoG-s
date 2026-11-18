// Réglage « Taille d'affichage » : un curseur par pas de 10 %, propre à l'appareil. Voir src/lib/zoom.js.
import { useState } from 'react';
import {
  ZOOM_DEFAULT, ZOOM_MIN, ZOOM_STEP, getZoom, saveZoom, applyZoom, maxZoomForScreen, supportsViewportZoom,
} from '../lib/zoom.js';

export default function DisplaySizeCard() {
  const max = maxZoomForScreen();
  const [applied, setApplied] = useState(() => getZoom());
  const [draft, setDraft] = useState(applied);
  const tactile = supportsViewportZoom();

  // Le zoom s'applique au relâchement du curseur, pas pendant qu'on le fait glisser : la page changerait de taille
  // sous le doigt et le curseur sauterait.
  function commit(value) {
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
          : "Sur ordinateur, utilise Ctrl et + pour agrandir, Ctrl et − pour réduire (Cmd sur Mac). Le curseur de zoom apparaît sur téléphone et tablette."}
      </p>

      {reglable && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 34 }}>{ZOOM_MIN}%</span>
            <input
              type="range"
              min={ZOOM_MIN}
              max={max}
              step={ZOOM_STEP}
              value={draft}
              aria-label="Taille d'affichage"
              aria-valuetext={`${draft} pour cent`}
              onChange={(e) => setDraft(Number(e.target.value))}
              onPointerUp={() => commit(draft)}
              onTouchEnd={() => commit(draft)}
              onKeyUp={() => commit(draft)}
              onBlur={() => commit(draft)}
              style={{ flex: 1, accentColor: 'var(--forest)', minWidth: 0 }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 34, textAlign: 'right' }}>{max}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {draft} %{draft === applied && applied !== ZOOM_DEFAULT ? ' · appliqué' : ''}
            </span>
            {applied !== ZOOM_DEFAULT && (
              <button
                type="button"
                onClick={() => { setDraft(ZOOM_DEFAULT); commit(ZOOM_DEFAULT); }}
                style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
              >
                Revenir à 100 %
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
