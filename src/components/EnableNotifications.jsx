import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { subscribeToPush, unsubscribeFromPush } from '../lib/push.js';
import { useToast } from './Toast.jsx';
import { supabase } from '../lib/supabase.js';

export default function EnableNotifications() {
  const { profile } = useAuth();
  const showToast = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      if (!profile?.id) return;

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setChecking(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          setIsSubscribed(true);
          await subscribeToPush(profile).catch(() => {}); 
        } else {
          setIsSubscribed(false);
        }
      } catch (err) {
        console.warn("Erreur vérification abonnement:", err);
      }
      setChecking(false);
    }
    checkStatus();
  }, [profile?.id]);

  const handleToggle = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromPush(profile);
        setIsSubscribed(false);
        showToast('Notifications désactivées sur cet appareil.', 'success');
      } else {
        await subscribeToPush(profile);
        setIsSubscribed(true);
        showToast('Notifications activées avec succès !', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      if (!profile) throw new Error("Profil introuvable.");
      
      // L'appel utilise le Token de sécurité, plus besoin de clé API
      const { data, error } = await supabase.functions.invoke('send-test-push', {
        body: { user_id: profile.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showToast('Notification de test envoyée !', 'success');
    } catch (err) {
      showToast("Erreur d'envoi : " + err.message, 'error');
    }
    setTesting(false);
  };

  if (checking) {
    return (
      <div className="card-bold" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-bell" style={{ fontSize: 20, color: 'var(--forest-dark)' }} aria-hidden="true"></i>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Notifications Push</p>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Vérification en cours...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-bold" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 40, height: 40, borderRadius: '50%', 
            background: isSubscribed ? 'var(--success-light)' : 'var(--line)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.3s'
          }}>
            <i className={`ti ti-bell ${isSubscribed ? 'ti-bell-ringing' : 'ti-bell-off'}`} style={{ fontSize: 20, color: isSubscribed ? 'var(--success)' : 'var(--muted)' }} aria-hidden="true"></i>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Notifications Push</p>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
              {isSubscribed ? 'Vous recevrez les alertes sur cet appareil.' : 'Activez pour recevoir les alertes.'}
            </p>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', cursor: loading ? 'wait' : 'pointer' }}>
          <div style={{ 
            position: 'relative', width: 50, height: 28, 
            background: isSubscribed ? 'var(--success)' : 'var(--line-strong)', 
            borderRadius: 28, transition: 'background 0.3s', 
            opacity: loading ? 0.6 : 1
          }}>
            <div style={{ 
              position: 'absolute', top: 3, left: isSubscribed ? 25 : 3, 
              width: 22, height: 22, background: '#fff', borderRadius: '50%', 
              transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
            }} />
          </div>
          <input 
            type="checkbox" 
            checked={isSubscribed} 
            onChange={handleToggle} 
            disabled={loading}
            style={{ display: 'none' }} 
          />
        </label>
      </div>

      {isSubscribed && (
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--success)',
            background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600,
            cursor: testing ? 'not-allowed' : 'pointer', opacity: testing ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {testing ? 'Envoi en cours...' : <><i className="ti ti-send" style={{ marginRight: 6 }}></i>Tester la notification</>}
        </button>
      )}

      {!isSubscribed && (
        <p style={{ margin: '0', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
          💡 Sur iPhone, il faut d'abord installer l'application sur l'écran d'accueil pour pouvoir activer les notifications.
        </p>
      )}
    </div>
  );
}
