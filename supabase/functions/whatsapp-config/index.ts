// Edge Function : lecture/écriture de la configuration WhatsApp Business
// (Meta Cloud API) d'une école.
//
// La table whatsapp_configs n'a AUCUNE policy RLS (voir supabase/schema.sql)
// — elle n'est donc accessible qu'ici, via service_role. Le jeton d'accès
// (access_token) n'est JAMAIS renvoyé au frontend, même à l'action "get" :
// seul un booléen has_token indique s'il est renseigné. Un school_id ne
// vient jamais du corps de la requête — toujours dérivé du profil de
// l'appelant, vérifié via son propre jeton d'authentification.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CAN_VIEW_ROLES = ['fondateur', 'directeur', 'secretaire'];
const CAN_MANAGE_ROLES = ['fondateur', 'directeur'];
const MESSAGE_TYPES = ['relance_paiement', 'echeance', 'annonce', 'vie_scolaire', 'message_individuel'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non authentifié.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error('Non authentifié.');

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .single();
    if (profileError || !callerProfile) throw new Error('Profil introuvable.');
    if (!CAN_VIEW_ROLES.includes(callerProfile.role)) {
      throw new Error("Vous n'avez pas accès à la configuration WhatsApp.");
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'save') {
      if (!CAN_MANAGE_ROLES.includes(callerProfile.role)) {
        throw new Error('Seuls le fondateur et le directeur peuvent modifier la configuration WhatsApp.');
      }

      const { data: existing } = await adminClient
        .from('whatsapp_configs')
        .select('id, access_token')
        .eq('school_id', callerProfile.school_id)
        .maybeSingle();

      const templates: Record<string, unknown> = {};
      if (body.templates && typeof body.templates === 'object') {
        for (const type of MESSAGE_TYPES) {
          const t = body.templates[type];
          if (t && typeof t.name === 'string' && t.name.trim()) {
            templates[type] = { name: t.name.trim(), lang: (typeof t.lang === 'string' && t.lang.trim()) || 'fr' };
          }
        }
      }

      const phoneNumberId = typeof body.phone_number_id === 'string' ? body.phone_number_id.trim() : '';
      // Un champ jeton laissé vide dans le formulaire ne doit jamais effacer
      // un jeton déjà enregistré — le frontend ne le reçoit jamais en retour
      // pour le réafficher, donc "vide" veut dire "inchangé", pas "à supprimer".
      const newToken = typeof body.access_token === 'string' && body.access_token.trim() ? body.access_token.trim() : null;
      const hasToken = !!(newToken || existing?.access_token);

      const payload: Record<string, unknown> = {
        school_id: callerProfile.school_id,
        phone_number_id: phoneNumberId || null,
        waba_id: typeof body.waba_id === 'string' ? body.waba_id.trim() || null : null,
        display_phone_number: typeof body.display_phone_number === 'string' ? body.display_phone_number.trim() || null : null,
        templates,
        quota_quotidien: Number.isFinite(Number(body.quota_quotidien)) && Number(body.quota_quotidien) > 0 ? Math.floor(Number(body.quota_quotidien)) : 200,
        statut: (phoneNumberId && hasToken) ? 'actif' : 'non_configure',
        derniere_erreur: null,
        updated_at: new Date().toISOString(),
      };
      if (newToken) payload.access_token = newToken;

      const { error: saveError } = existing
        ? await adminClient.from('whatsapp_configs').update(payload).eq('id', existing.id)
        : await adminClient.from('whatsapp_configs').insert(payload);
      if (saveError) throw new Error(saveError.message);

      return jsonResponse({ ok: true });
    }

    // action par défaut : "get" — jamais le token, seulement un indicateur.
    const { data: config } = await adminClient
      .from('whatsapp_configs')
      .select('phone_number_id, waba_id, display_phone_number, statut, derniere_erreur, quota_quotidien, templates, access_token, updated_at')
      .eq('school_id', callerProfile.school_id)
      .maybeSingle();

    return jsonResponse({
      configured: !!config,
      statut: config?.statut || 'non_configure',
      phone_number_id: config?.phone_number_id || null,
      waba_id: config?.waba_id || null,
      display_phone_number: config?.display_phone_number || null,
      derniere_erreur: config?.derniere_erreur || null,
      quota_quotidien: config?.quota_quotidien ?? 200,
      templates: config?.templates || {},
      has_token: !!config?.access_token,
      updated_at: config?.updated_at || null,
      can_manage: CAN_MANAGE_ROLES.includes(callerProfile.role),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
