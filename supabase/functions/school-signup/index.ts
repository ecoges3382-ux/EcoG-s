// Edge Function publique : crée un compte fondateur uniquement après
// consommation atomique d'un code d'inscription individuel. Le code est
// réservé avant la création Auth, puis libéré si celle-ci échoue.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  let invitationId: string | null = null;
  let claimedAt: string | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Configuration serveur incomplète.');
    adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const method = body?.method;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const schoolName = typeof body?.school_name === 'string' ? body.school_name.trim() : '';
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!['email', 'phone'].includes(method)) return jsonResponse({ error: 'Choisis une adresse e-mail ou un téléphone.' }, 400);
    if (method === 'email' && (!email || email.length > 254)) return jsonResponse({ error: 'Adresse e-mail invalide.' }, 400);
    if (method === 'phone' && !/^\+[1-9]\d{7,14}$/.test(phone)) return jsonResponse({ error: 'Numéro de téléphone invalide.' }, 400);
    if (password.length < 8 || password.length > 128) return jsonResponse({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, 400);
    if (!schoolName || schoolName.length > 160 || !fullName || fullName.length > 160) {
      return jsonResponse({ error: 'Le nom de l’école et votre nom sont obligatoires.' }, 400);
    }
    if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/.test(code)) {
      return jsonResponse({ error: 'Code invalide, expiré ou déjà utilisé. Demande un nouveau code à l’administrateur.' }, 400);
    }

    claimedAt = new Date().toISOString();
    const { data: invitation, error: claimError } = await adminClient
      .from('school_signup_invites')
      .update({ used_at: claimedAt })
      .eq('code', code)
      .is('used_at', null)
      .gt('expires_at', claimedAt)
      .select('id')
      .maybeSingle();
    if (claimError) throw new Error('Impossible de vérifier le code pour le moment.');
    if (!invitation) {
      return jsonResponse({ error: 'Code invalide, expiré ou déjà utilisé. Demande un nouveau code à l’administrateur.' }, 400);
    }
    invitationId = invitation.id;

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      ...(method === 'email' ? { email, email_confirm: false } : { phone, phone_confirm: false }),
      password,
      user_metadata: { school_name: schoolName, full_name: fullName },
    });
    if (createError || !created.user) {
      await adminClient.from('school_signup_invites')
        .update({ used_at: null })
        .eq('id', invitationId)
        .eq('used_at', claimedAt);
      invitationId = null;
      const message = createError?.code === 'email_exists' || createError?.code === 'phone_exists'
        ? `Un compte existe déjà avec cet ${method === 'email' ? 'e-mail' : 'numéro'}.`
        : 'La création du compte a échoué. Vérifie les informations et réessaie.';
      return jsonResponse({ error: message }, 400);
    }

    await adminClient.from('school_signup_invites')
      .update({ used_by: created.user.id })
      .eq('id', invitationId);
    return jsonResponse({ ok: true });
  } catch (err) {
    if (adminClient && invitationId && claimedAt) {
      await adminClient.from('school_signup_invites')
        .update({ used_at: null })
        .eq('id', invitationId)
        .eq('used_at', claimedAt);
    }
    return jsonResponse({ error: err instanceof Error ? err.message : 'Une erreur est survenue.' }, 400);
  }
});
