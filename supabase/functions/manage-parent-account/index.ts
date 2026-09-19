// Edge Function : création / suppression d'un compte parent, par un membre
// du personnel (fondateur, directeur, secrétaire). Même raison d'être que
// manage-staff-account : fixer le mot de passe de quelqu'un d'autre exige
// la clé service_role, qui ne doit jamais atteindre le navigateur.
//
// Un compte parent est lié explicitement à un ou plusieurs élèves (table
// student_guardians), choisis par la personne qui crée le compte — pas
// deviné par correspondance d'e-mail, pour éviter qu'une faute de frappe
// relie un parent au mauvais enfant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const STAFF_ROLES_THAT_CAN_MANAGE = ['fondateur', 'directeur', 'secretaire'];

// Même logique que formatPhoneE164 côté frontend (src/lib/utils.js) —
// dupliquée ici car les Edge Functions tournent dans un runtime Deno
// séparé, sans accès au code du frontend.
function formatPhoneE164(raw: string, defaultCountryCode = '229'): string {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  return `+${defaultCountryCode}${cleaned.replace(/^0+/, '')}`;
}

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
    if (!STAFF_ROLES_THAT_CAN_MANAGE.includes(callerProfile.role)) {
      throw new Error('Seuls le fondateur, le directeur ou la secrétaire peuvent gérer les comptes parents.');
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
      if (target.role !== 'parent') throw new Error("Ce n'est pas un compte parent.");

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(profileId);
      if (deleteAuthError) throw new Error(deleteAuthError.message);

      return jsonResponse({ ok: true });
    }

    if (body.action === 'update') {
      const { profileId, email, password, phone } = body;
      if (!profileId) throw new Error('profileId manquant.');
      if (!email && !password && !phone) throw new Error('Rien à modifier.');
      if (password && String(password).length < 8) throw new Error('Mot de passe trop court (8 caractères minimum).');

      const { data: target, error: targetError } = await adminClient
        .from('profiles')
        .select('school_id, role')
        .eq('id', profileId)
        .single();
      if (targetError || !target) throw new Error('Compte introuvable.');
      if (target.school_id !== callerProfile.school_id) throw new Error("Ce compte n'appartient pas à votre école.");
      if (target.role !== 'parent') throw new Error("Ce n'est pas un compte parent.");

      const authUpdate: Record<string, unknown> = {};
      if (email) { authUpdate.email = email; authUpdate.email_confirm = true; }
      if (password) authUpdate.password = password;
      const formattedPhone = phone ? formatPhoneE164(phone) : null;
      if (formattedPhone) { authUpdate.phone = formattedPhone; authUpdate.phone_confirm = true; }

      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(profileId, authUpdate);
      if (updateAuthError) throw new Error(updateAuthError.message);

      const profileUpdate: Record<string, unknown> = {};
      if (email) profileUpdate.email = email;
      if (formattedPhone) profileUpdate.phone = formattedPhone;
      if (Object.keys(profileUpdate).length) {
        const { error: updateProfileError } = await adminClient.from('profiles').update(profileUpdate).eq('id', profileId);
        if (updateProfileError) throw new Error(updateProfileError.message);
      }

      return jsonResponse({ ok: true });
    }

    // action par défaut : "create"
    const { full_name, email, password, phone, student_ids } = body;
    if (!full_name || !email || !password) throw new Error('Champs manquants.');
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      throw new Error('Sélectionnez au moins un élève.');
    }
    if (String(password).length < 8) throw new Error('Mot de passe trop court (8 caractères minimum).');

    // Vérifie que chaque élève appartient bien à l'école de l'appelant,
    // pour ne jamais pouvoir relier un parent à l'enfant d'une autre école.
    const { data: matchingStudents, error: studentsError } = await adminClient
      .from('students')
      .select('id')
      .eq('school_id', callerProfile.school_id)
      .in('id', student_ids);
    if (studentsError) throw new Error(studentsError.message);
    if (!matchingStudents || matchingStudents.length !== student_ids.length) {
      throw new Error("Un ou plusieurs élèves sélectionnés n'appartiennent pas à votre école.");
    }

    const formattedPhone = phone ? formatPhoneE164(phone) : null;
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      ...(formattedPhone ? { phone: formattedPhone, phone_confirm: true } : {}),
    });
    if (createError) throw new Error(createError.message);

    const { error: insertProfileError } = await adminClient.from('profiles').insert({
      id: created.user.id,
      school_id: callerProfile.school_id,
      full_name,
      role: 'parent',
      email,
      phone: formattedPhone,
    });
    if (insertProfileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw new Error(insertProfileError.message);
    }

    const { error: linkError } = await adminClient.from('student_guardians').insert(
      student_ids.map((student_id: string) => ({ student_id, parent_profile_id: created.user.id })),
    );
    if (linkError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw new Error(linkError.message);
    }

    if (phone) {
      // Champ facultatif, stocké sur la fiche du premier élève lié si vide.
      await adminClient
        .from('students')
        .update({ parent_name: full_name, parent_email: email })
        .in('id', student_ids)
        .is('parent_email', null);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
