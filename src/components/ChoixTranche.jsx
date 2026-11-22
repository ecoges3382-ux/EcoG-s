// « Tranche / Type » d'un paiement : une liste déroulante où l'on peut COCHER PLUSIEURS tranches d'écolage (un parent qui paie la 1ère et
// la 2ème d'un coup), puis valider avec « OK ». Les autres choix (Moitié, Complet / Solde, Autre) sont exclusifs : en choisir un décoche
// les tranches. Le montant total des tranches cochées s'affiche en bas. Règles : src/lib/paymentForm.js.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtF, trancheLabel } from '../lib/utils.js';
import { tranchesCochees, basculerTranche, identifiantTranches, montantPropose } from '../lib/paymentForm.js';

// choix : [{ id, label, montant }] ; value : identifiant (« tranche1+tranche2 » pour plusieurs tranches) ; onChange(identifiant).
export default function ChoixTranche({ value, onChange, choix, style, disabled = false }) {
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState(value);
  const [coords, setCoords] = useState(null);
  const racine = useRef(null);
  const panneau = useRef(null);

  // À l'ouverture, on repart de la valeur actuelle.
  useEffect(() => { if (ouvert) setBrouillon(value); }, [ouvert, value]);
  // Le panneau est posé sur la page (hors de la fenêtre de paiement, qui le couperait), sous le champ, ou au-dessus s'il manque de place.
  useLayoutEffect(() => {
    if (!ouvert) return;
    const r = racine.current.getBoundingClientRect();
    const dessous = window.innerHeight - r.bottom;
    const versLeHaut = dessous < 320 && r.top > dessous;
    const largeur = Math.max(r.width, 290);
    setCoords({ left: Math.max(8, Math.min(r.left, window.innerWidth - largeur - 8)), width: largeur, versLeHaut, top: versLeHaut ? undefined : r.bottom + 6, bottom: versLeHaut ? window.innerHeight - r.top + 6 : undefined });
  }, [ouvert]);
  useEffect(() => {
    if (!ouvert) return undefined;
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    const dehors = (e) => {
      const dansChamp = racine.current && racine.current.contains(e.target);
      const dansPanneau = panneau.current && panneau.current.contains(e.target);
      if (!dansChamp && !dansPanneau) setOuvert(false);
    };
    document.addEventListener('keydown', echap);
    document.addEventListener('mousedown', dehors);
    return () => { document.removeEventListener('keydown', echap); document.removeEventListener('mousedown', dehors); };
  }, [ouvert]);

  const tranches = choix.filter((c) => /^tranche\d+$/.test(c.id));
  const autres = choix.filter((c) => !/^tranche\d+$/.test(c.id));
  const cochees = tranchesCochees(brouillon);
  const total = montantPropose(choix, brouillon);
  const libelle = (id) => choix.find((c) => c.id === id)?.label || trancheLabel(id);
  const actuel = tranchesCochees(value).length > 1 ? trancheLabel(value) : libelle(value);

  function valider() { if (brouillon) onChange(brouillon); setOuvert(false); }
  const ligne = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', fontSize: 13.5, cursor: 'pointer', borderBottom: '1px solid var(--line)' };

  return (
    <div ref={racine} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setOuvert((v) => !v)}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={ouvert}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, ...style }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{actuel}</span>
        <i className={`ti ${ouvert ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 15, flexShrink: 0, color: 'var(--muted)', marginLeft: 8 }} aria-hidden="true"></i>
      </button>

      {ouvert && coords && createPortal(
        <div ref={panneau} role="group" aria-label="Tranches à payer" style={{ position: 'fixed', zIndex: 200, left: coords.left, width: coords.width, ...(coords.versLeHaut ? { bottom: coords.bottom } : { top: coords.top }), maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', border: '1px solid var(--line-strong)', borderRadius: 10, background: 'var(--paper)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {tranches.length > 0 && (
            <>
              <p style={{ margin: 0, padding: '9px 12px 6px', fontSize: 11.5, color: 'var(--muted)' }}>Coche une ou plusieurs tranches à payer d'un coup.</p>
              {tranches.map((t) => {
                const coche = cochees.includes(t.id);
                return (
                  <label key={t.id} style={{ ...ligne, fontWeight: coche ? 700 : 500 }}>
                    <input type="checkbox" checked={coche} onChange={() => setBrouillon(identifiantTranches(basculerTranche(choix, cochees, t.id)) || '')} style={{ width: 17, height: 17, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{t.label}</span>
                    {t.montant > 0 && <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{fmtF(t.montant)}</span>}
                  </label>
                );
              })}
            </>
          )}
          {autres.map((c) => {
            const actif = brouillon === c.id;
            return (
              <label key={c.id} style={{ ...ligne, fontWeight: actif ? 700 : 500 }}>
                <input type="radio" name="choix-exclusif" checked={actif} onChange={() => setBrouillon(c.id)} style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{c.label}</span>
                {c.montant > 0 && <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{fmtF(c.montant)}</span>}
              </label>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: 'var(--cream)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{cochees.length > 1 && total ? `Total : ${fmtF(total)}` : ' '}</span>
            <button type="button" onClick={valider} disabled={!brouillon} style={{ padding: '8px 22px', borderRadius: 9, border: 'none', background: brouillon ? 'var(--forest)' : 'var(--line-strong)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: brouillon ? 'pointer' : 'default' }}>OK</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
