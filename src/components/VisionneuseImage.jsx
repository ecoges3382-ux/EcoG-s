// Visionneuse plein écran d'une image du Chat : l'image s'ouvre DANS l'application (plus de nouvel onglet du navigateur).
// Boutons Enregistrer et Partager (feuille de partage du téléphone). Se ferme avec la croix, un toucher à côté de l'image, la touche
// Échap, ou le bouton « retour » du téléphone (qui ramène alors au Chat au lieu de quitter la page).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { enregistrerFichierChat, nomFichierChat, partageDisponible, partagerFichierChat, preparerFichierChat } from '../lib/fichiersChat.js';

const stop = (e) => e.stopPropagation();

export default function VisionneuseImage({ m, url, onClose }) {
  const [info, setInfo] = useState('');
  const [occupe, setOccupe] = useState(false);
  const peutPartager = partageDisponible();
  const entreeHistorique = useRef(false);
  const fermeeParRetour = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Le bouton « retour » du téléphone ferme la visionneuse : on ajoute une entrée d'historique le temps de son affichage.
  useEffect(() => {
    try {
      window.history.pushState({ ...(window.history.state || {}), visionneuseChat: true }, '');
      entreeHistorique.current = true;
    } catch { /* historique indisponible : la croix suffit */ }
    const surRetour = () => { fermeeParRetour.current = true; entreeHistorique.current = false; onCloseRef.current(); };
    window.addEventListener('popstate', surRetour);
    return () => {
      window.removeEventListener('popstate', surRetour);
      // Fermée autrement (croix, Échap) : on retire l'entrée ajoutée, pour que « retour » ne reste pas sans effet.
      if (entreeHistorique.current && !fermeeParRetour.current && window.history.state?.visionneuseChat) window.history.back();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Le partage exige un fichier déjà téléchargé : on le prépare dès l'ouverture.
  useEffect(() => { if (peutPartager) preparerFichierChat(m); }, [m, peutPartager]);

  async function enregistrer() {
    setOccupe(true);
    const ok = await enregistrerFichierChat(m);
    setOccupe(false);
    setInfo(ok ? 'Téléchargement lancé.' : "Impossible d'enregistrer cette image.");
  }
  async function partager() {
    setOccupe(true);
    const r = await partagerFichierChat(m);
    setOccupe(false);
    if (r === 'partage') setInfo('');
    else if (r === 'indisponible') setInfo("Le partage n'est pas disponible ici. Utilisez « Enregistrer ».");
  }

  const bouton = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: occupe ? 'default' : 'pointer', opacity: occupe ? 0.6 : 1 };

  return createPortal(
    <div
      role="dialog" aria-label="Image" aria-modal="true"
      // Un portail laisse remonter les événements jusqu'à la bulle du message : sans ceci, toucher la visionneuse déclencherait le menu du message.
      onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop} onTouchCancel={stop} onContextMenu={stop} onMouseEnter={stop} onMouseLeave={stop}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.97)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(10px + env(safe-area-inset-top)) 12px 10px' }}>
        <button type="button" onClick={onClose} aria-label="Fermer" style={{ ...bouton, padding: '10px 12px' }}>
          <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true"></i>
        </button>
        <span style={{ flex: 1, minWidth: 0, color: '#fff', fontSize: 13, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomFichierChat(m)}</span>
      </div>
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <img src={url} alt="" draggable={false} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', touchAction: 'pinch-zoom' }} />
      </div>
      <div style={{ padding: '10px 12px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {info && <span role="status" style={{ color: '#fff', fontSize: 12.5, opacity: 0.9, textAlign: 'center' }}>{info}</span>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={enregistrer} disabled={occupe} style={bouton}><i className="ti ti-download" style={{ fontSize: 18 }} aria-hidden="true"></i>Enregistrer</button>
          {peutPartager && <button type="button" onClick={partager} disabled={occupe} style={bouton}><i className="ti ti-share-3" style={{ fontSize: 18 }} aria-hidden="true"></i>Partager</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
