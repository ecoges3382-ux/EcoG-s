// Edge Function PUBLIQUE : création d'un compte administrateur de la
// plateforme à partir d'une invitation (e-mail + code) déjà créée par un
// administrateur existant depuis PlatformAdmin.jsx → onglet Administrateurs
// (table platform_admin_invites). Aucune session requise pour l'appeler —
// comme parent-portal, c'est justement le point : ce compte n'existe pas
// encore. Le code, communiqué hors système (téléphone, WhatsApp...) par
// l'administrateur qui a créé l'invitation, est la seule barrière contre
// une création arbitraire de compte administrateur.
//
// Le compte créé ici n'a JAMAIS de ligne "profiles" ni d'école associée —
// juste un compte Supabase Auth + une ligne platform_admins. Contrairement
// à un compte créé via "Créer une école" (SignUp.jsx), il ne peut donc pas
// se retrouver mêlé à la liste des écoles (voir platform-admin/index.ts,
// action "list", qui masque de toute façon toute école dont le personnel
// n'est composé que d'administrateurs).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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

// Anti-brute-force : même mécanisme, mêmes seuils que parent-portal
// (parent_access_attempts) — un endpoint public protégé par un code à 8
// caractères mérite la même garde, ici pour un enjeu plus élevé (un succès
// crée un vrai compte administrateur). Seules les tentatives à code
// INVALIDE comptent.
const RATE_LIMIT_MAX_ATTEMPTS = 30;
const RATE_LIMIT_WINDOW_MINUTES = 15;

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);
    const ip = clientIp(req);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();

    const { count: recentFailures } = await adminClient
      .from('platform_admin_signup_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', windowStart);
    if ((recentFailures || 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
      return jsonResponse({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' }, 429);
    }

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const code = String(body.code || '').trim().toUpperCase();

    if (!email || !password || !code) throw new Error('E-mail, mot de passe et code sont obligatoires.');
    if (password.length < 8) throw new Error('Le mot de passe doit faire au moins 8 caractères.');

    // Le code doit correspondre à une invitation non consommée, non
    // expirée, et à CET e-mail précis — jamais un code valable pour
    // n'importe quel e-mail (l'invitation est nominative dès sa création).
    const { data: invite, error: inviteError } = await adminClient
      .from('platform_admin_invites')
      .select('id, email, used_at, expires_at')
      .eq('code', code)
      .maybeSingle();
    if (inviteError) throw new Error(inviteError.message);
    if (!invite || invite.used_at || new Date(invite.expires_at) < new Date() || invite.email !== email) {
      // Journalise l'échec (purge au passage les entrées de plus d'une
      // heure, tous IPs confondus — voir parent-portal pour le même choix).
      await adminClient.from('platform_admin_signup_attempts').insert({ ip });
      await adminClient.from('platform_admin_signup_attempts').delete().lt('created_at', new Date(Date.now() - 3_600_000).toISOString());

      if (!invite) throw new Error('Code invalide.');
      if (invite.used_at) throw new Error('Ce code a déjà été utilisé.');
      if (new Date(invite.expires_at) < new Date()) throw new Error('Ce code a expiré — demande une nouvelle invitation.');
      throw new Error("Ce code ne correspond pas à cet e-mail.");
    }

    // email_confirm: true — le code lui-même est déjà la preuve d'invitation
    // (communiqué hors système par un administrateur existant), pas besoin
    // d'un deuxième aller-retour par e-mail de confirmation avant de
    // pouvoir se connecter.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw new Error(createError.message);

    const { error: adminInsertError } = await adminClient.from('platform_admins').insert({ user_id: created.user.id });
    if (adminInsertError) {
      // Compte créé mais promotion échouée (cas très improbable) : on ne
      // laisse jamais un compte Auth orphelin sans le rôle qu'il était
      // censé recevoir — mieux vaut annuler complètement que la moitié.
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw new Error(adminInsertError.message);
    }

    await adminClient.from('platform_admin_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id);

    await adminClient.from('platform_admin_actions').insert({
      admin_user_id: created.user.id,
      action: 'signup_via_invite',
      details: `Compte administrateur créé via invitation (${email})`,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
