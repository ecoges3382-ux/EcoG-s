import { supabase } from './supabase.js';

// Le frontend ne parle jamais directement à l'API Meta ni ne voit de jeton
// — tout passe par ces deux Edge Functions (service_role côté serveur),
// qui vérifient elles-mêmes l'appelant, son école et son droit d'agir.
export async function getWhatsAppConfig() {
  const { data, error } = await supabase.functions.invoke('whatsapp-config', { body: {} });
  if (error || data?.error) throw new Error(data?.error || 'Erreur de chargement.');
  return data;
}

export async function saveWhatsAppConfig(payload) {
  const { data, error } = await supabase.functions.invoke('whatsapp-config', { body: { action: 'save', ...payload } });
  if (error || data?.error) throw new Error(data?.error || 'Erreur d\'enregistrement.');
  return data;
}

export async function sendWhatsAppMessage(payload) {
  const { data, error } = await supabase.functions.invoke('whatsapp-send', { body: payload });
  if (error || data?.error) throw new Error(data?.error || "Erreur d'envoi.");
  return data;
}

export const WHATSAPP_TYPE_LABELS = {
  relance_paiement: 'Relance de paiement',
  echeance: "Rappel d'échéance",
  annonce: 'Annonce',
  vie_scolaire: 'Vie scolaire',
  message_individuel: 'Message individuel',
};

export const WHATSAPP_STATUT_LABELS = {
  en_attente: { label: 'En attente', bg: '#F0EDE5', fg: 'var(--muted)' },
  envoye: { label: 'Envoyé', bg: 'var(--success-light)', fg: 'var(--success)' },
  livre: { label: 'Livré', bg: 'var(--success-light)', fg: 'var(--success)' },
  lu: { label: 'Lu', bg: 'var(--forest-light)', fg: 'var(--forest-dark)' },
  echec: { label: 'Échec', bg: 'var(--danger-light)', fg: 'var(--danger)' },
};
