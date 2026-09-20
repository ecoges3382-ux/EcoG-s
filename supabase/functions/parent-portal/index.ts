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
          students ( id, full_name, photo_url, matricule, moyenne, bulletin_pret )
        )
      `)
      .eq('code', code)
      .maybeSingle();
    if (accessError) throw new Error(accessError.message);
    if (!access) throw new Error('Code invalide.');

    // La classe et le dû/payé d'un élève sont propres à l'année scolaire en
    // cours (table enrollments) — students ne garde que son identité.
    const { data: schoolYear } = await adminClient
      .from('school_years')
      .select('id, label')
      .eq('school_id', access.school_id)
      .eq('is_current', true)
      .maybeSingle();

    const rawStudents = (access.parent_access_students || [])
      .map((row: { students: unknown }) => row.students)
      .filter(Boolean) as { id: string }[];

    const enrollmentByStudent = new Map<string, { montant_du: number; montant_paye: number; frais_connexe_du: number; frais_connexe_paye: number; classes: { nom: string } | null }>();
    if (schoolYear && rawStudents.length > 0) {
      const { data: enr } = await adminClient
        .from('enrollments')
        .select('student_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, classes ( nom )')
        .eq('school_year_id', schoolYear.id)
        .in('student_id', rawStudents.map((s) => s.id));
      (enr || []).forEach((e: { student_id: string } & Record<string, unknown>) => enrollmentByStudent.set(e.student_id, e as never));
    }

    const students = rawStudents.map((s) => {
      const en = enrollmentByStudent.get(s.id);
      return {
        ...s,
        niveau: en?.classes?.nom || null,
        montant_du: en?.montant_du ?? 0,
        montant_paye: en?.montant_paye ?? 0,
        frais_connexe_du: en?.frais_connexe_du ?? 0,
        frais_connexe_paye: en?.frais_connexe_paye ?? 0,
      };
    });

    if (body.action === 'detail') {
      const student = students.find((s: { id: string }) => s.id === body.student_id);
      if (!student) throw new Error("Cet élève n'est pas rattaché à ce code.");

      const yearId = schoolYear?.id || null;
      const [{ data: payments }, { data: attendance }, { data: grades }, { data: subjects }, { data: announcements }] = await Promise.all([
        adminClient.from('payments').select('*').eq('student_id', student.id).eq('school_year_id', yearId).order('date', { ascending: false }),
        adminClient.from('attendance_records').select('*').eq('student_id', student.id).eq('school_year_id', yearId).order('date', { ascending: false }).limit(30),
        adminClient.from('grades').select('*').eq('student_id', student.id).eq('school_year_id', yearId).order('created_at', { ascending: false }),
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
