import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { supabase } from '../lib/supabase.js';
import {
  CANAL_VERSION, EVENEMENT_DEPLOIEMENT, DELAI_VERIFICATION, DELAI_RAPPEL, creerVerificateur, planifierApresSignal,
} from '../lib/miseAJour.js';
import {
  VERSION_INSTALLEE, versionPerimee, rechargementPropre, controlerVersion, majEtat, lireEtat, abonner, enregistrerVerification,
} from '../lib/versionApp.js';

// tempsReel : écoute le signal de déploiement (espace du personnel). Le portail parent s'en passe : pas de connexion Realtime de plus.
export default function UpdateButton({ tempsReel = true }) {
  const [updating, setUpdating] = useState(false);
  const inscription = useRef(null);
  const verifierRef = useRef(null);
  if (!verifierRef.current) verifierRef.current = creerVerificateur({ donneInscription: () => inscription.current, controlerVersion });
  // Deuxième détection, indépendante du service worker : la version en ligne n'est pas celle qui tourne ici.
  const etat = useSyncExternalStore(abonner, lireEtat);
  const perimee = versionPerimee(VERSION_INSTALLEE, etat.versionEnLigne);
  const [masquee, setMasquee] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      inscription.current = r || null;
      // Dès l'inscription : une première vérification (l'application a pu rester ouverte longtemps avant de s'inscrire).
      verifierRef.current({ force: true });
    },
    onRegisterError(error) {
      console.error('Erreur Service Worker:', error);
    },
  });

  // Le diagnostic (Paramètres) peut demander une vérification immédiate ; et on en fait une dès l'ouverture, sans attendre
  // l'inscription du service worker.
  useEffect(() => {
    const verifier = (opts) => verifierRef.current(opts);
    verifier({ force: true });
    return enregistrerVerification(() => verifier({ force: true }));
  }, []);

  // Quand chercher une nouvelle version : toutes les minutes tant que l'application est visible, et surtout DÈS qu'on y revient
  // (retour au premier plan, onglet réaffiché, réseau retrouvé). Sur téléphone, une application en arrière-plan gèle ses
  // minuteries : sans cela, la mise à jour n'était vue qu'après un rechargement.
  useEffect(() => {
    const verifier = (opts) => verifierRef.current(opts);
    const siVisible = () => { if (document.visibilityState === 'visible') verifier(); };
    const minuterie = setInterval(siVisible, DELAI_VERIFICATION);
    document.addEventListener('visibilitychange', siVisible);
    window.addEventListener('focus', siVisible);
    window.addEventListener('online', siVisible);
    window.addEventListener('pageshow', siVisible);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', siVisible);
      window.removeEventListener('focus', siVisible);
      window.removeEventListener('online', siVisible);
      window.removeEventListener('pageshow', siVisible);
    };
  }, []);

  // Signal « une version vient d'être déployée » (envoyé par GitHub quand Vercel a fini de publier) : on cherche aussitôt, sans
  // attendre la prochaine minute. Le signal ne contient rien : l'application refait elle-même la vérification, donc un faux
  // signal ne peut rien causer de plus qu'une vérification.
  useEffect(() => {
    if (!tempsReel) { majEtat({ canal: 'désactivé' }); return undefined; }
    let annulerSerie = null;
    let canal = null;
    try {
      canal = supabase.channel(CANAL_VERSION)
        .on('broadcast', { event: EVENEMENT_DEPLOIEMENT }, () => {
          majEtat({ dernierSignal: Date.now() });
          if (annulerSerie) annulerSerie();
          annulerSerie = planifierApresSignal((opts) => verifierRef.current(opts));
        })
        .subscribe((statut) => majEtat({ canal: statut }));
    } catch (err) {
      console.error('Canal de mise à jour indisponible:', err);
      majEtat({ canal: 'indisponible' });
    }
    return () => {
      if (annulerSerie) annulerSerie();
      try { if (canal) supabase.removeChannel(canal); } catch { /* canal déjà fermé : on ignore */ }
    };
  }, [tempsReel]);

  // « Plus tard » ne cache la bannière que pour un temps : la mise à jour attend toujours, la bannière revient.
  const rappel = useRef(null);
  useEffect(() => () => clearTimeout(rappel.current), []);

  const handleUpdate = async () => {
    setUpdating(true);
    if (!needRefresh) {
      // Le service worker n'a rien signalé mais la version en ligne est différente : il n'y a pas de nouveau service worker
      // à activer, on repart d'une copie propre.
      await rechargementPropre();
      return;
    }
    // Si l'activation classique n'aboutit pas en quelques secondes, on repart d'une copie propre plutôt que de rester bloqué.
    const secours = setTimeout(() => rechargementPropre(), 8000);
    try {
      // Cette fonction de Workbox force le nouveau Service Worker à prendre
      // le contrôle et recharge la page automatiquement.
      await updateServiceWorker(true);
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      clearTimeout(secours);
      window.location.reload();
    }
  };

  const close = () => {
    setMasquee(true);
    clearTimeout(rappel.current);
    rappel.current = setTimeout(() => setMasquee(false), DELAI_RAPPEL);
  };

  // On n'affiche rien s'il n'y a pas de mise à jour
  if (!(needRefresh || perimee) || masquee) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 16, right: 16, margin: '0 auto', maxWidth: 400,
      background: '#1a1a1a', color: '#fff', padding: '18px 20px', borderRadius: 16,
      display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      zIndex: 9999, animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 10 }}>
           <i className="ti ti-sparkles" style={{ fontSize: 20, color: 'var(--gold)' }} aria-hidden="true"></i>
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
          Une nouvelle version d'EcoGès est disponible !
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button 
          onClick={handleUpdate} 
          disabled={updating}
          style={{ 
            flex: 1, background: 'var(--forest)', color: '#fff', border: 'none', padding: '12px', 
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: updating ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}
        >
          <i className={`ti ti-refresh ${updating ? 'animate-spin' : ''}`} style={{ fontSize: 18 }} aria-hidden="true"></i>
          {updating ? 'Mise à jour…' : 'Mettre à jour'}
        </button>
        <button 
          onClick={close} 
          style={{ 
            background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', 
            padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
