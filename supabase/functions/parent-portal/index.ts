// Edge Function : consultation par un parent, via son code d'accès.
//
// Contrairement aux autres Edge Functions de l'appli, celle-ci n'exige
// aucune identité appelante (pas de compte, pas de session) — le "mot de
// passe" est le code lui-même. Elle tourne avec la clé service_role pour
// pouvoir lire au-delà de la RLS (un parent n'a par définition aucun rôle
// reconnu par la base), mais ne renvoie jamais que les données des élèves
// effectivement rattachés au code fourni.

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) throw new Error('Code manquant.');

    const { data: access, error: accessError } = await adminClient
      .from('parent_access')
      .select(`
        id, full_name, school_id,
        parent_access_students (
          students ( id, full_name, niveau, photo_url, matricule, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, moyenne, bulletin_pret )
        )
      `)
      .eq('code', code)
      .maybeSingle();
    if (accessError) throw new Error(accessError.message);
    if (!access) throw new Error('Code invalide.');

    const students = (access.parent_access_students || [])
      .map((row: { students: unknown }) => row.students)
      .filter(Boolean);

    if (body.action === 'detail') {
      const student = students.find((s: { id: string }) => s.id === body.student_id);
      if (!student) throw new Error("Cet élève n'est pas rattaché à ce code.");

      const [{ data: payments }, { data: attendance }, { data: grades }, { data: subjects }, { data: announcements }] = await Promise.all([
        adminClient.from('payments').select('*').eq('student_id', student.id).order('date', { ascending: false }),
        adminClient.from('attendance_records').select('*').eq('student_id', student.id).order('date', { ascending: false }).limit(30),
        adminClient.from('grades').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
        adminClient.from('subjects').select('id, nom, coefficient').eq('school_id', access.school_id),
        adminClient.from('announcements').select('*').eq('school_id', access.school_id).order('created_at', { ascending: false }).limit(10),
      ]);

      const subjectsById = new Map((subjects || []).map((s: { id: string }) => [s.id, s]));
      const gradesWithSubject = (grades || []).map((g: { subject_id: string }) => ({ ...g, subject: subjectsById.get(g.subject_id) || null }));
      const relevantAnnouncements = (announcements || []).filter(
        (a: { portee: string; classe_cible: string | null }) => a.portee === 'École entière' || a.classe_cible === student.niveau,
      );

      return jsonResponse({
        full_name: access.full_name,
        student,
        payments: payments || [],
        attendance: attendance || [],
        grades: gradesWithSubject,
        announcements: relevantAnnouncements,
      });
    }

    return jsonResponse({ full_name: access.full_name, students });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
