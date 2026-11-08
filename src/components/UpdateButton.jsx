import { useState, useEffect } from 'react';

export default function UpdateButton() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
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

  return (
    <div>
      <button
        onClick={handleUpdate}
        disabled={updating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 8, border: '1px solid var(--line-strong)',
          background: hasUpdate ? 'var(--forest)' : 'var(--paper)',
          color: hasUpdate ? '#fff' : 'var(--ink)',
          fontSize: 13, fontWeight: 600, cursor: updating ? 'wait' : 'pointer',
          boxShadow: hasUpdate ? '0 2px 10px rgba(15, 76, 58, 0.3)' : 'none',
          transition: 'all 0.3s'
        }}
      >
        <i className={`ti ti-refresh ${updating ? 'animate-spin' : ''}`} style={{ fontSize: 16 }} aria-hidden="true"></i>
        {updating ? 'Mise à jour en cours...' : hasUpdate ? 'Mettre à jour l\'application' : 'Forcer l\'actualisation'}
      </button>
      
      {hasUpdate && (
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--success)', fontWeight: 600 }}>
          <i className="ti ti-check" aria-hidden="true"></i> Une nouvelle version est prête !
        </p>
      )}
    </div>
  );
}
