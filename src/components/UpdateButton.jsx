import { useState, useEffect, useRef } from 'react';

export default function UpdateButton() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  // On stocke la version actuelle de l'application en mémoire
  const currentVersionRef = useRef(null);

  useEffect(() => {
    // Fonction pour récupérer la version depuis le fichier version.json
    const checkVersion = async () => {
      try {
        // On ajoute un paramètre pour éviter que le navigateur ne mette le fichier en cache
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        
        // Si c'est la première fois qu'on charge l'app, on enregistre la version actuelle
        if (currentVersionRef.current === null) {
          currentVersionRef.current = data.version;
          return;
        }

        // Si la version du serveur est différente de la nôtre, une mise à jour est disponible
        if (data.version !== currentVersionRef.current) {
          setHasUpdate(true);
        }
      } catch (error) {
        // On ignore les erreurs silencieusement (ex: si le fichier n'existe pas encore)
      }
    };

    // 1. Vérification immédiate au chargement de l'application
    checkVersion();

    // 2. Vérification périodique toutes les minutes
    const interval = setInterval(checkVersion, 60 * 1000); // 1 minute

    // 3. Vérification quand l'utilisateur revient sur l'onglet ou l'application
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Nettoyage
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      // On vide le cache du Service Worker et on recharge la page
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
      
      // On recharge avec un paramètre pour forcer le navigateur à tout recharger
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.href = url.toString();
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      window.location.reload();
    }
  };

  const close = () => setHasUpdate(false);

  // On n'affiche rien s'il n'y a pas de mise à jour
  if (!hasUpdate) return null;

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
