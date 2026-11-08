import { useState, useEffect } from 'react';

export default function UpdateButton() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        
        // 👇 LA LIGNE MAGIQUE POUR LE MOBILE 👇
        // Force le navigateur mobile à aller voir sur Vercel s'il y a une nouvelle version
        registration.update();

        if (registration.waiting) setHasUpdate(true);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // Si le nouveau worker est installé et qu'un ancien tourne encore
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
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink)', color: '#fff', padding: '12px 20px', borderRadius: 50,
      display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: 9999, animation: 'slideUp 0.3s ease-out', width: 'max-content', maxWidth: '90vw'
    }}>
      <span style={{ fontSize: 13.5, fontWeight: 500 }}>Une nouvelle version est disponible.</span>
      <button 
        onClick={handleUpdate} 
        disabled={updating}
        style={{ 
          background: 'var(--forest)', color: '#fff', border: 'none', padding: '8px 16px', 
          borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: updating ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
        }}
      >
        <i className={`ti ti-refresh ${updating ? 'animate-spin' : ''}`} style={{ fontSize: 14 }} aria-hidden="true"></i>
        {updating ? 'Mise à jour…' : 'Mettre à jour'}
      </button>
    </div>
  );
}
