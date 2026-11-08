import { useState, useEffect } from 'react';

export default function UpdateButton() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();

        if (registration.waiting) setHasUpdate(true);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setHasUpdate(true);
              }
            });
          }
        });
      });
    }
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }

      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.href = url.toString();
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      window.location.reload();
    }
  };

  if (!hasUpdate) return null;

  return (
    <div style={{
      position: 'fixed', 
      bottom: 20, 
      left: 16, 
      right: 16, 
      margin: '0 auto', 
      maxWidth: 400,
      background: '#1a1a1a', // Fond sombre profond
      color: '#fff', 
      padding: '18px 20px', 
      borderRadius: 16, // Bords plus doux
      display: 'flex', 
      flexDirection: 'column', // Force le texte en haut et le bouton en bas
      gap: 14, 
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      zIndex: 9999, 
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 10 }}>
           <i className="ti ti-sparkles" style={{ fontSize: 20, color: 'var(--gold)' }} aria-hidden="true"></i>
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
          Une nouvelle version d'EcoGès est disponible !
        </p>
      </div>

      <button 
        onClick={handleUpdate} 
        disabled={updating}
        style={{ 
          background: 'var(--forest)', color: '#fff', border: 'none', padding: '12px', 
          borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: updating ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', transition: 'background 0.2s'
        }}
      >
        <i className={`ti ti-refresh ${updating ? 'animate-spin' : ''}`} style={{ fontSize: 18 }} aria-hidden="true"></i>
        {updating ? 'Mise à jour en cours...' : 'Mettre à jour maintenant'}
      </button>
    </div>
  );
}
