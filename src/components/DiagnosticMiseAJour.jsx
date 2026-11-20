// Paramètres (fondateur) : pourquoi cet appareil voit, ou ne voit pas, la bannière « nouvelle version ». Montre la version
// installée face à la version en ligne, l'état du service worker et du canal temps réel, et permet de forcer une vérification
// ou de repartir d'une copie propre.
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  VERSION_INSTALLEE, versionPerimee, libelleVersion, etatServiceWorker, rechargementPropre, lireEtat, abonner, verifierMaintenant,
} from '../lib/versionApp.js';

const heure = (t) => (t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'jamais');

const CANAL = {
  SUBSCRIBED: { texte: 'connecté', ok: true },
  CHANNEL_ERROR: { texte: 'erreur (accès refusé par Supabase ?)', ok: false },
  TIMED_OUT: { texte: 'délai dépassé', ok: false },
  CLOSED: { texte: 'fermé', ok: false },
};

function Ligne({ label, valeur, ok }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', color: ok === false ? 'var(--danger)' : 'inherit' }}>{valeur}</span>
    </div>
  );
}

export default function DiagnosticMiseAJour() {
  const etat = useSyncExternalStore(abonner, lireEtat);
  const [sw, setSw] = useState('…');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => { etatServiceWorker().then(setSw); }, [etat.derniereVerification]);

  const perimee = versionPerimee(VERSION_INSTALLEE, etat.versionEnLigne);
  const canal = CANAL[etat.canal] || { texte: etat.canal, ok: etat.canal === 'désactivé' ? undefined : false };

  let verdict;
  if (etat.lectureEchouee) verdict = { ok: false, texte: 'Impossible de lire la version en ligne (connexion ?).' };
  else if (!etat.versionEnLigne) verdict = { ok: undefined, texte: 'Vérification en cours…' };
  else if (perimee) verdict = { ok: false, texte: 'Cet appareil n\'est pas à jour : la bannière doit s\'afficher.' };
  else verdict = { ok: true, texte: 'Cet appareil est à jour.' };

  async function verifier() {
    setOccupe(true);
    await verifierMaintenant();
    setOccupe(false);
  }

  const bouton = { fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--forest)', cursor: 'pointer' };

  return (
    <div className="card-bold" style={{ padding: '16px 20px' }}>
      <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>Diagnostic des mises à jour</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>
        Pour comprendre pourquoi la bannière « nouvelle version » apparaît ou non sur cet appareil.
      </p>
      <p role="status" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: verdict.ok === false ? 'var(--danger)' : verdict.ok ? 'var(--forest-text)' : 'var(--muted)' }}>{verdict.texte}</p>
      <Ligne label="Version installée" valeur={libelleVersion(VERSION_INSTALLEE)} />
      <Ligne label="Version en ligne" valeur={etat.lectureEchouee ? 'illisible' : libelleVersion(etat.versionEnLigne)} ok={etat.lectureEchouee ? false : undefined} />
      <Ligne label="Service worker" valeur={sw} />
      <Ligne label="Canal temps réel" valeur={canal.texte} ok={canal.ok} />
      <Ligne label="Dernier signal reçu" valeur={heure(etat.dernierSignal)} />
      <Ligne label="Dernière vérification" valeur={heure(etat.derniereVerification)} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" onClick={verifier} disabled={occupe} style={{ ...bouton, background: 'var(--forest-light)', color: 'var(--forest-dark-text)' }}>
          {occupe ? 'Vérification…' : 'Vérifier maintenant'}
        </button>
        <button type="button" onClick={() => rechargementPropre()} style={{ ...bouton, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
          Recharger proprement
        </button>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
        « Recharger proprement » vide la copie enregistrée de l'application sur cet appareil puis la recharge. Ta connexion est conservée.
      </p>
    </div>
  );
}
