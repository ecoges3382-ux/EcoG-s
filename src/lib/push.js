import { supabase } from './supabase.js';

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

export async function subscribeToPush(profile) {
  // 1. Vérifier que le navigateur supporte les notifications
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error("Ton navigateur ne supporte pas les notifications.");
  }

  // 2. Demander la permission à l'utilisateur
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error("Tu as refusé les notifications.");
  }

  // 3. Attendre que le Service Worker soit prêt
  const registration = await navigator.serviceWorker.ready;

  // 4. S'abonner avec la clé publique (celle qu'on a mise sur Vercel)
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("La clé publique VAPID est manquante sur Vercel.");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });

  const subData = subscription.toJSON();

  // 5. 🚀 Sauvegarder l'abonnement via l'Edge Function (service_role, contourne la RLS)
  const { data, error } = await supabase.functions.invoke('subscribe-push', {
    body: {
      endpoint: subData.endpoint,
      p256dh: subData.keys.p256dh,
      auth: subData.keys.auth,
    }
  });

  if (error) throw new Error("Erreur d'abonnement : " + error.message);
  if (data?.error) throw new Error(data.error);

  return true;
}
