import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdateButton() {
  const [updating, setUpdating] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Vérifie les mises à jour toutes les minutes si l'app est ouverte
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Erreur Service Worker:', error);
    },
  });

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      // Cette fonction de Workbox force le nouveau Service Worker à prendre
      // le contrôle et recharge la page automatiquement.
      await updateServiceWorker(true);
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      window.location.reload();
    }
    setUpdating(false);
  };

  const close = () => setNeedRefresh(false);

  // On n'affiche rien s'il n'y a pas de mise à jour
  if (!needRefresh) return null;

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
