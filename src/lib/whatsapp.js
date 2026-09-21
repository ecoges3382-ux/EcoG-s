import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase.js';

// supabase-js ne remplit PAS `data` quand la fonction répond en erreur (code
// non 2xx) — il faut aller lire le corps JSON réel dans error.context (une
// Response brute) pour récupérer le message envoyé par la fonction, sinon
// on retombe sur un message générique qui masque la vraie raison (ex.
// "WhatsApp n'est pas configuré pour votre école") à chaque échec serveur.
async function invokeFn(name, body, fallbackMessage) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let serverMessage = null;
    if (error instanceof FunctionsHttpError) {
      // .json() ne peut échouer que si le corps n'est pas du JSON valide —
      // dans ce cas on se rabat sur fallbackMessage, jamais sur ce throw.
      serverMessage = await error.context.json().then((b) => b?.error || null).catch(() => null);
    }
    throw new Error(serverMessage || fallbackMessage);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Le frontend ne parle jamais directement à l'API Meta ni ne voit de jeton
// — tout passe par ces deux Edge Functions (service_role côté serveur),
// qui vérifient elles-mêmes l'appelant, son école et son droit d'agir.
export function getWhatsAppConfig() {
  return invokeFn('whatsapp-config', {}, 'Erreur de chargement.');
}

export function saveWhatsAppConfig(payload) {
  return invokeFn('whatsapp-config', { action: 'save', ...payload }, "Erreur d'enregistrement.");
}

export function sendWhatsAppMessage(payload) {
  return invokeFn('whatsapp-send', payload, "Erreur d'envoi.");
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
