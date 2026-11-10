import { supabase } from './supabase.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(profile) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error("Les notifications ne sont pas supportées par ce navigateur.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error("Vous avez refusé les notifications.");
  }

  const registration = await navigator.serviceWorker.ready;
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Clé VAPID manquante dans Vercel.");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }

  const subData = JSON.parse(JSON.stringify(subscription));

  // 1. On supprime l'ancien abonnement s'il existe (corrige l'erreur ON CONFLICT)
  await supabase.from('push_subscriptions').delete().eq('user_id', profile.id);

  // 2. On insère le nouveau avec school_id (corrige l'erreur NOT NULL)
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: profile.id,
    school_id: profile.school_id,
    endpoint: subData.endpoint,
    p256dh: subData.keys.p256dh,
    auth: subData.keys.auth,
  });

  if (error) throw error;
}

export async function unsubscribeFromPush(profile) {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  await supabase.from('push_subscriptions').delete().eq('user_id', profile.id);
}
