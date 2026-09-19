// Edge Function : création / suppression d'un compte de connexion pour un
// membre de l'équipe (directeur, secrétaire, enseignant), par le fondateur.
//
// Pourquoi une fonction serveur : créer un compte Supabase Auth avec un
// mot de passe choisi par quelqu'un d'autre, ou supprimer le compte d'un
// tiers, exige la clé "service_role" — une clé qui contourne toutes les
// protections et ne doit donc jamais circuler jusqu'au navigateur. Cette
// fonction tourne côté serveur, avec cette clé injectée automatiquement
// par Supabase (jamais exposée au client), et vérifie elle-même que
// l'appelant est bien le fondateur de l'école avant d'agir.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ALLOWED_ROLES = ['directeur', 'secretaire', 'enseignant'];

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

    // Client "vu par l'appelant" : sert uniquement à vérifier qui il est,
    // via son propre jeton — jamais à agir en son nom au-delà de ça.
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
    if (callerProfile.role !== 'fondateur') {
      throw new Error('Seul le fondateur peut gérer les comptes.');
    }

    const body = await req.json();
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (body.action === 'delete') {
      const { profileId } = body;
      if (!profileId) throw new Error('profileId manquant.');

      const { data: target, error: targetError } = await adminClient
        .from('profiles')
        .select('school_id, role')
        .eq('id', profileId)
        .single();
      if (targetError || !target) throw new Error('Compte introuvable.');
      if (target.school_id !== callerProfile.school_id) throw new Error("Ce compte n'appartient pas à votre école.");
      if (target.role === 'fondateur') throw new Error('Le compte fondateur ne peut pas être supprimé ici.');

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(profileId);
      if (deleteAuthError) throw new Error(deleteAuthError.message);
      // La ligne "profiles" est supprimée automatiquement (on delete cascade
      // sur profiles.id -> auth.users.id).

      return jsonResponse({ ok: true });
    }

    // action par défaut : "create"
    const { full_name, email, password, role } = body;
    if (!full_name || !email || !password || !role) throw new Error('Champs manquants.');
    if (!ALLOWED_ROLES.includes(role)) throw new Error('Rôle invalide.');
    if (String(password).length < 8) throw new Error('Mot de passe trop court (8 caractères minimum).');

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw new Error(createError.message);

    const { error: insertError } = await adminClient.from('profiles').insert({
      id: created.user.id,
      school_id: callerProfile.school_id,
      full_name,
      role,
      email,
    });
    if (insertError) {
      // Compte orphelin sans profil : on annule plutôt que de le laisser traîner.
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw new Error(insertError.message);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
