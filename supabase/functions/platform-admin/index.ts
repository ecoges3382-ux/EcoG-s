// Edge Function : administration de la plateforme (écoles, personnel de
// support, journal d'activité, administrateurs de la plateforme), réservée
// aux comptes listés dans la table "platform_admins" — indépendant du rôle
// "fondateur", qui lui ne donne accès qu'à une seule école.
//
// Pourquoi une fonction serveur : lister toutes les écoles et calculer
// leurs effectifs exige de contourner les règles RLS (normalement chaque
// école ne voit que ses propres données) ; supprimer une école exige aussi
// de supprimer les comptes Supabase Auth de son personnel ; générer un lien
// de connexion/réinitialisation pour un compte exige l'API Admin Auth. Tout
// ça nécessite la clé "service_role", qui ne doit jamais atteindre le
// navigateur.
//
// Le statut ('essai'/'actif'/'suspendu'/'resilie', voir supabase/schema.sql)
// n'est pas qu'une étiquette d'affichage : current_school_id() refuse tout
// accès applicatif dès qu'une école est suspendue/résiliée, donc "set_statut"
// coupe réellement l'école, immédiatement, pas seulement dans cette UI. La
// suppression définitive ("delete") est donc réservée à une école déjà
// suspendue/résiliée — revérifié ici, jamais seulement côté frontend.
//
// Chaque action qui change quelque chose (statut, note, suppression,
// connexion à la place d'un compte, réinitialisation de mot de passe, ajout/
// retrait d'un administrateur) écrit une ligne dans platform_admin_actions —
// jamais d'action silencieuse depuis cet écran.

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

// deno-lint-ignore no-explicit-any
async function logAction(
  adminClient: any,
  adminUserId: string,
  action: string,
  opts: { schoolId?: string | null; targetProfileId?: string | null; targetLabel?: string | null; details?: string | null } = {},
) {
  let schoolName: string | null = null;
  if (opts.schoolId) {
    const { data } = await adminClient.from('schools').select('name').eq('id', opts.schoolId).maybeSingle();
    schoolName = data?.name || null;
  }
  await adminClient.from('platform_admin_actions').insert({
    admin_user_id: adminUserId,
    action,
    school_id: opts.schoolId || null,
    school_name: schoolName,
    target_profile_id: opts.targetProfileId || null,
    target_label: opts.targetLabel || null,
    details: opts.details || null,
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

    const { data: admin } = await callerClient
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!admin) throw new Error("Accès réservé à l'administrateur de la plateforme.");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    const STATUTS = ['essai', 'actif', 'suspendu', 'resilie'];

    // ---------- Écoles ----------

    if (body.action === 'set_statut') {
      const { schoolId, statut } = body;
      if (!schoolId) throw new Error('schoolId manquant.');
      if (!STATUTS.includes(statut)) throw new Error('Statut invalide.');

      const { error: updateError } = await adminClient.from('schools').update({ statut }).eq('id', schoolId);
      if (updateError) throw new Error(updateError.message);
      await logAction(adminClient, user.id, 'set_statut', { schoolId, details: `Nouveau statut : ${statut}` });
      return jsonResponse({ ok: true });
    }

    if (body.action === 'set_note') {
      const { schoolId, note } = body;
      if (!schoolId) throw new Error('schoolId manquant.');

      const cleanNote = typeof note === 'string' ? note.trim() || null : null;
      const { error: updateError } = await adminClient
        .from('schools')
        .update({ note_administrative: cleanNote })
        .eq('id', schoolId);
      if (updateError) throw new Error(updateError.message);
      await logAction(adminClient, user.id, 'set_note', { schoolId, details: 'Note administrative modifiée' });
      return jsonResponse({ ok: true });
    }

    if (body.action === 'delete') {
      const { schoolId } = body;
      if (!schoolId) throw new Error('schoolId manquant.');

      // Suppression définitive réservée à une école déjà suspendue/résiliée
      // — jamais un raccourci direct depuis "actif"/"essai". Revérifié ici
      // côté serveur, jamais seulement côté interface (voir PlatformAdmin.jsx).
      const { data: school, error: schoolError } = await adminClient
        .from('schools')
        .select('statut, name')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolError) throw new Error(schoolError.message);
      if (!school) throw new Error('École introuvable.');
      if (school.statut !== 'suspendu' && school.statut !== 'resilie') {
        throw new Error("Cette école doit d'abord être suspendue avant de pouvoir être supprimée définitivement.");
      }

      // Comptes du personnel de cette école : on les supprime un par un via
      // l'API Auth (ça supprime aussi leur ligne "profiles" en cascade),
      // avant de supprimer l'école elle-même (qui entraîne en cascade tout
      // le reste : élèves, paiements, classes, accès parents, etc.).
      const { data: staffProfiles, error: staffError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('school_id', schoolId);
      if (staffError) throw new Error(staffError.message);

      // Filet de sécurité : platform_admins.user_id référence auth.users(id)
      // ON DELETE CASCADE — supprimer le compte Auth d'un administrateur de
      // la plateforme (parce qu'il est aussi personnel de cette école, ex.
      // un compte créé via "Créer une école" avant d'être promu admin)
      // supprimerait donc AUSSI sa ligne platform_admins, l'excluant
      // possiblement lui-même (ou un collègue) de la plateforme sans
      // confirmation explicite de ce risque précis.
      if ((staffProfiles || []).some((p) => p.id === user.id)) {
        throw new Error("Ton propre compte fait partie du personnel de cette école — la supprimer supprimerait aussi ton compte (et ton statut d'administrateur de la plateforme, qui en dépend). Retire d'abord ton profil de cette école (delete from profiles where id = '...'), ou demande à un autre administrateur de supprimer cette école.");
      }

      for (const p of staffProfiles || []) {
        await adminClient.auth.admin.deleteUser(p.id);
      }

      // Le journal garde une trace même de cette école désormais supprimée
      // (school_id passera à NULL via on delete set null, school_name reste).
      await logAction(adminClient, user.id, 'delete', {
        schoolId,
        details: `École supprimée définitivement (${(staffProfiles || []).length} compte(s) personnel supprimé(s))`,
      });

      const { error: deleteError } = await adminClient.from('schools').delete().eq('id', schoolId);
      if (deleteError) throw new Error(deleteError.message);

      return jsonResponse({ ok: true });
    }

    // Détail d'une école : liste de son personnel, pour la fiche détail et
    // pour choisir un compte à impersonner / réinitialiser ci-dessous.
    if (body.action === 'school_detail') {
      const { schoolId } = body;
      if (!schoolId) throw new Error('schoolId manquant.');
      const { data: staff, error: staffErr } = await adminClient
        .from('profiles')
        .select('id, full_name, role, email, phone, created_at')
        .eq('school_id', schoolId)
        .order('role');
      if (staffErr) throw new Error(staffErr.message);
      return jsonResponse({ staff: staff || [] });
    }

    // ---------- Support : connexion à la place d'un compte, mot de passe ----------

    if (body.action === 'impersonate' || body.action === 'reset_password') {
      const { schoolId, profileId } = body;
      if (!schoolId || !profileId) throw new Error('Paramètres manquants.');

      const { data: target, error: targetErr } = await adminClient
        .from('profiles')
        .select('id, full_name, email, school_id')
        .eq('id', profileId)
        .maybeSingle();
      if (targetErr) throw new Error(targetErr.message);
      if (!target || target.school_id !== schoolId) throw new Error('Compte introuvable pour cette école.');
      if (!target.email) {
        throw new Error("Ce compte n'a pas d'adresse e-mail enregistrée : impossible de générer un lien (seuls les comptes créés avec un e-mail le permettent).");
      }

      const linkType = body.action === 'impersonate' ? 'magiclink' : 'recovery';
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: linkType,
        email: target.email,
      });
      if (linkError) throw new Error(linkError.message);

      await logAction(adminClient, user.id, body.action, {
        schoolId,
        targetProfileId: target.id,
        targetLabel: target.full_name,
        details: body.action === 'impersonate' ? 'Lien de connexion généré' : 'Lien de réinitialisation généré',
      });

      return jsonResponse({ link: linkData.properties.action_link });
    }

    // ---------- Administrateurs de la plateforme ----------

    if (body.action === 'list_admins') {
      const { data: admins, error: adminsErr } = await adminClient
        .from('platform_admins')
        .select('user_id, created_at')
        .order('created_at');
      if (adminsErr) throw new Error(adminsErr.message);

      const withEmail = await Promise.all((admins || []).map(async (a: { user_id: string; created_at: string }) => {
        const { data } = await adminClient.auth.admin.getUserById(a.user_id);
        return { user_id: a.user_id, created_at: a.created_at, email: data?.user?.email || null };
      }));
      return jsonResponse({ admins: withEmail });
    }

    if (body.action === 'add_admin') {
      const { email } = body;
      if (!email || !String(email).trim()) throw new Error('E-mail manquant.');

      const { data: targetUserId, error: rpcError } = await adminClient.rpc('find_user_id_by_email', { p_email: email });
      if (rpcError) throw new Error(rpcError.message);
      if (!targetUserId) {
        throw new Error("Aucun compte EcoGès avec cet e-mail. La personne doit d'abord avoir un compte (ex. fondateur d'une école) avant de pouvoir devenir administratrice de la plateforme.");
      }

      const { error: insertError } = await adminClient.from('platform_admins').insert({ user_id: targetUserId });
      if (insertError) {
        if (insertError.code === '23505') throw new Error('Cette personne est déjà administratrice de la plateforme.');
        throw new Error(insertError.message);
      }
      await logAction(adminClient, user.id, 'add_admin', { details: `Ajout de ${String(email).trim()} comme administrateur plateforme` });
      return jsonResponse({ ok: true });
    }

    if (body.action === 'remove_admin') {
      const { userId } = body;
      if (!userId) throw new Error('userId manquant.');

      const { count } = await adminClient.from('platform_admins').select('user_id', { count: 'exact', head: true });
      if ((count || 0) <= 1) throw new Error('Impossible de retirer le dernier administrateur de la plateforme.');

      const { data: target } = await adminClient.auth.admin.getUserById(userId);
      const { error: deleteError } = await adminClient.from('platform_admins').delete().eq('user_id', userId);
      if (deleteError) throw new Error(deleteError.message);
      await logAction(adminClient, user.id, 'remove_admin', { details: `Retrait de ${target?.user?.email || userId} des administrateurs plateforme` });
      return jsonResponse({ ok: true });
    }

    // ---------- Journal d'activité ----------

    if (body.action === 'list_actions') {
      const { data: actions, error: actionsErr } = await adminClient
        .from('platform_admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (actionsErr) throw new Error(actionsErr.message);

      const adminIds = [...new Set((actions || []).map((a: { admin_user_id: string }) => a.admin_user_id))];
      const adminEmails: Record<string, string> = {};
      for (const id of adminIds as string[]) {
        const { data } = await adminClient.auth.admin.getUserById(id);
        adminEmails[id] = data?.user?.email || id;
      }
      return jsonResponse({
        actions: (actions || []).map((a: { admin_user_id: string }) => ({ ...a, admin_email: adminEmails[a.admin_user_id] })),
      });
    }

    // action par défaut : "list"
    const { data: schools, error: schoolsError } = await adminClient
      .from('schools')
      .select('id, name, color, logo_url, created_at, statut, note_administrative')
      .order('created_at', { ascending: false });
    if (schoolsError) throw new Error(schoolsError.message);

    const schoolIds = (schools || []).map((s) => s.id);
    const [{ data: profiles }, { data: students }] = await Promise.all([
      adminClient.from('profiles').select('school_id').in('school_id', schoolIds),
      adminClient.from('students').select('school_id').in('school_id', schoolIds),
    ]);

    const staffCounts: Record<string, number> = {};
    for (const p of profiles || []) staffCounts[p.school_id] = (staffCounts[p.school_id] || 0) + 1;
    const studentCounts: Record<string, number> = {};
    for (const s of students || []) studentCounts[s.school_id] = (studentCounts[s.school_id] || 0) + 1;

    const result = (schools || []).map((s) => ({
      ...s,
      staffCount: staffCounts[s.id] || 0,
      studentCount: studentCounts[s.id] || 0,
    }));

    return jsonResponse({ schools: result });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
