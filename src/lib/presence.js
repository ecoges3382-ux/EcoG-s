// Présence « en ligne » de l'école : un seul canal temps réel par école,
// démarré une fois par le Shell, lu par le chat. « En ligne » veut dire :
// l'application est ouverte sur son appareil en ce moment.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';

let channel = null;
let currentKey = null;
let snapshot = new Set();
const listeners = new Set();

function setOnline(ids) {
  snapshot = new Set(ids);
  listeners.forEach((l) => l());
}

export function startPresence(userId, schoolId) {
  if (!userId || !schoolId) return;
  const key = `${schoolId}:${userId}`;
  if (channel && currentKey === key) return;
  stopPresence();
  currentKey = key;
  try {
    const ch = supabase.channel(`presence_${schoolId}`, { config: { presence: { key: userId } } });
    ch.on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState())));
    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      try { await ch.track({ at: Date.now() }); } catch (err) { console.warn('[presence] track a échoué :', err); }
    });
    channel = ch;
  } catch (err) {
    // La présence est un confort : si elle échoue, l'app continue sans.
    console.warn('[presence] démarrage impossible :', err);
    channel = null;
    currentKey = null;
  }
}

export function stopPresence() {
  if (channel) {
    try { supabase.removeChannel(channel); } catch { /* canal déjà fermé : on ignore */ }
  }
  channel = null;
  currentKey = null;
  if (snapshot.size > 0) setOnline([]);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Ensemble des identifiants des personnes en ligne (inclut soi-même).
export function useOnlineUsers() {
  return useSyncExternalStore(subscribe, () => snapshot);
}
