// Edge Function : administration de la plateforme (liste des écoles,
// suppression complète d'une école), réservée aux comptes listés dans la
// table "platform_admins" — indépendant du rôle "fondateur", qui lui ne
// donne accès qu'à une seule école.
//
// Pourquoi une fonction serveur : lister toutes les écoles et calculer
// leurs effectifs exige de contourner les règles RLS (normalement chaque
// école ne voit que ses propres données) ; supprimer une école exige aussi
// de supprimer les comptes Supabase Auth de son personnel (la suppression
// en cascade au niveau base ne touche que les lignes "profiles", pas les
// comptes "auth.users" sous-jacents). Tout ça nécessite la clé
// "service_role", qui ne doit jamais atteindre le navigateur.

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

    if (body.action === 'delete') {
      const { schoolId } = body;
      if (!schoolId) throw new Error('schoolId manquant.');

      // Comptes du personnel de cette école : on les supprime un par un via
      // l'API Auth (ça supprime aussi leur ligne "profiles" en cascade),
      // avant de supprimer l'école elle-même (qui entraîne en cascade tout
      // le reste : élèves, paiements, classes, accès parents, etc.).
      const { data: staffProfiles, error: staffError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('school_id', schoolId);
      if (staffError) throw new Error(staffError.message);

      for (const p of staffProfiles || []) {
        await adminClient.auth.admin.deleteUser(p.id);
      }

      const { error: deleteError } = await adminClient.from('schools').delete().eq('id', schoolId);
      if (deleteError) throw new Error(deleteError.message);

      return jsonResponse({ ok: true });
    }

    // action par défaut : "list"
    const { data: schools, error: schoolsError } = await adminClient
      .from('schools')
      .select('id, name, color, logo_url, created_at')
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
