import { supabase } from './supabase.js';

// Petite fonction magique pour transformer la clé VAPID en format que le navigateur comprend
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

  // 5. Sauvegarder l'abonnement dans la base de données Supabase
  const subData = subscription.toJSON();
  
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: profile.id,
    school_id: profile.school_id,
    endpoint: subData.endpoint,
    p256dh: subData.keys.p256dh,
    auth: subData.keys.auth,
  }, { onConflict: 'endpoint' });

  if (error) throw new Error("Erreur lors de la sauvegarde en base : " + error.message);

  return true;
}
