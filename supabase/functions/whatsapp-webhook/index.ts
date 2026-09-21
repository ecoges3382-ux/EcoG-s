// Edge Function : point d'entrée webhook Meta Cloud API (statuts de
// livraison/lecture des messages WhatsApp envoyés par whatsapp-send).
//
// Une seule App Meta est partagée par toutes les écoles (c'est le modèle
// standard pour un fournisseur de logiciel comme EcoGès — chaque école
// connecte son propre numéro/compte WhatsApp Business à cette App, mais
// l'App elle-même, son "App Secret" et son jeton de vérification webhook
// sont uniques et partagés). C'est pourquoi WHATSAPP_APP_SECRET et
// WHATSAPP_WEBHOOK_VERIFY_TOKEN sont des secrets globaux (Deno.env), pas
// une colonne par école — contrairement au jeton d'accès et au
// phone_number_id, qui eux sont propres à chaque école (whatsapp_configs).
//
// Sécurité : le school_id n'est JAMAIS déduit d'un champ du payload entrant
// (un webhook n'a "aucune notion fiable" de qui il représente) — chaque
// statut reçu est retrouvé par son provider_message_id, déjà enregistré par
// whatsapp-send avec le bon school_id au moment de l'envoi. Un id inconnu
// est simplement ignoré.
//
// Non testable sans un vrai App Meta configuré (voir rapport) : la
// validation de signature ci-dessous suit exactement le schéma documenté
// par Meta (HMAC-SHA256 de l'App Secret sur le corps brut), mais n'a jamais
// reçu de trafic réel.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: corsHeaders });
}
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expectedHex = signatureHeader.slice('sha256='.length);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  // Comparaison en temps constant, longueur déjà fixe (sortie SHA-256).
  if (computedHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) diff |= computedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

const STATUS_MAP: Record<string, string> = { sent: 'envoye', delivered: 'livre', read: 'lu', failed: 'echec' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Vérification d'abonnement Meta (une seule fois, à la configuration du
  // webhook dans le dashboard Meta) : renvoyer le challenge tel quel si le
  // verify_token correspond.
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') || '';
    const expected = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) {
      return textResponse(challenge, 200);
    }
    return textResponse('Forbidden', 403);
  }

  if (req.method !== 'POST') return textResponse('Method not allowed', 405);

  try {
    const rawBody = await req.text();
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
    if (!appSecret) {
      // Tant que le secret n'est pas configuré, on refuse plutôt que
      // d'accepter des statuts non authentifiés — jamais de mode "confiance
      // par défaut" pour un endpoint public.
      return jsonResponse({ error: 'WHATSAPP_APP_SECRET non configuré côté serveur.' }, 500);
    }
    const validSignature = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret);
    if (!validSignature) return jsonResponse({ error: 'Signature invalide.' }, 401);

    const payload = JSON.parse(rawBody);
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const statuses = change?.value?.statuses || [];
        for (const s of statuses) {
          const providerMessageId = s?.id;
          const mapped = STATUS_MAP[s?.status];
          if (!providerMessageId || !mapped) continue;
          const errorMsg = Array.isArray(s?.errors) && s.errors.length ? String(s.errors[0]?.title || s.errors[0]?.message || '') : null;
          // Retrouvé UNIQUEMENT par provider_message_id — jamais par un
          // school_id ou destinataire fourni dans le payload lui-même.
          await adminClient
            .from('whatsapp_messages')
            .update({ statut: mapped, erreur: errorMsg, updated_at: new Date().toISOString() })
            .eq('provider_message_id', providerMessageId);
        }
      }
    }

    // Toujours 200 rapidement — Meta réessaie et finit par désactiver le
    // webhook si les réponses sont lentes ou en erreur.
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 200);
  }
});
