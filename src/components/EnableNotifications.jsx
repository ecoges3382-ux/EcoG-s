import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { subscribeToPush } from '../lib/push.js';
import { useToast } from './Toast.jsx';
import { supabase } from '../lib/supabase.js';

export default function EnableNotifications() {
  const { profile } = useAuth();
  const showToast = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await subscribeToPush(profile);
      showToast('Notifications activées avec succès !', 'success');
      setDone(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      if (!profile) throw new Error("Profil introuvable.");
      
      const { data, error } = await supabase.functions.invoke('send-test-push', {
        body: { user_id: profile.id },
        headers: { 
          'x-api-key': import.meta.env.VITE_PUSH_API_SECRET 
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showToast('Notification de test envoyée !', 'success');
    } catch (err) {
      showToast("Erreur d'envoi : " + err.message, 'error');
    }
    setTesting(false);
  };

  if (done) {
    return (
      <div className="card-bold" style={{ padding: 20, background: 'var(--success-light)', borderColor: 'var(--success)' }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600, color: 'var(--success)' }}>
          ✅ Les notifications sont activées sur cet appareil.
        </p>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, border: 'none',
            background: 'var(--success)', color: '#fff', fontWeight: 600,
            cursor: testing ? 'not-allowed' : 'pointer', opacity: testing ? 0.7 : 1
          }}
        >
          {testing ? 'Envoi en cours...' : 'Tester la notification'}
        </button>
      </div>
    );
  }

  return (
    <div className="card-bold" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-bell" style={{ fontSize: 20, color: 'var(--forest-dark)' }} aria-hidden="true"></i>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Notifications Push</p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Reçois les alertes directement sur ton téléphone.</p>
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          width: '100%', padding: '10px', borderRadius: 8, border: 'none',
          background: 'var(--forest)', color: '#fff', fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Activation en cours...' : 'Activer les notifications'}
      </button>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
        💡 Sur iPhone, il faut d'abord installer l'application sur l'écran d'accueil.
      </p>
    </div>
  );
}
