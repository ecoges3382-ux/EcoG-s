import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ParentPushButton({ code }) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(sub => {
          if (sub) setEnabled(true);
        });
      });
    }
  }, []);

  async function subscribe() {
    setLoading(true);
    setError('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error("Ton navigateur ne supporte pas les notifications.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error("Tu as refusé les notifications.");
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      const subData = subscription.toJSON();

      const { data, error: fnError } = await supabase.functions.invoke('subscribe-parent-push', {
        body: { code, subscription: subData }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setEnabled(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  if (enabled) {
    return (
      <div style={{ background: 'var(--success-light)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className="ti ti-bell-check" style={{ fontSize: 20, color: 'var(--success)' }}></i>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
          Notifications activées sur cet appareil.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--forest-light)', borderRadius: 12, padding: '16px', marginBottom: 16, border: '1px solid var(--forest)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <i className="ti ti-bell" style={{ fontSize: 22, color: 'var(--forest-dark)' }}></i>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--forest-dark)' }}>Rester informé</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--forest-dark)', opacity: 0.8 }}>Reçois une alerte quand ton enfant est absent.</p>
        </div>
      </div>
      <button
        onClick={subscribe}
        disabled={loading}
        style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Activation…' : 'Activer les notifications'}
      </button>
      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--danger)', textAlign: 'center', fontWeight: 600 }}>{error}</p>}
    </div>
  );
}
