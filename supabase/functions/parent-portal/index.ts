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

// Anti-brute-force : le code (8 caractères, alphabet de 32 sans caractères
// ambigus, ~40 bits) résiste déjà à un brute-force aléatoire pur, mais cet
// endpoint est public et sans compte — rien d'autre ne limitait le débit.
// Seules les tentatives à code INVALIDE comptent (une session légitime
// renvoie son propre code correct plusieurs fois sans jamais déclencher ce
// compteur). Fenêtre généreuse : une école utilise souvent une seule
// adresse IP publique (Wi-Fi/NAT) partagée par des dizaines de parents en
// même temps (ex. soir de remise des bulletins) — trop bas bloquerait des
// familles légitimes. 30 échecs/15 min par IP reste des ordres de grandeur
// en dessous de ce qu'il faudrait pour espérer trouver un code au hasard.
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
      .from('parent_access_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', windowStart);
    if ((recentFailures || 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
      return jsonResponse({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' }, 429);
    }

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
    if (!access) {
      // Journalise l'échec (purge au passage les entrées de plus d'une
      // heure, tous IPs confondus, pour ne pas laisser grossir la table
      // indéfiniment sans avoir besoin d'un job planifié séparé).
      await adminClient.from('parent_access_attempts').insert({ ip });
      await adminClient.from('parent_access_attempts').delete().lt('created_at', new Date(Date.now() - 3_600_000).toISOString());
      throw new Error('Code invalide.');
    }

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

    const enrollmentByStudent = new Map<string, { montant_du: number; montant_paye: number; frais_connexe_du: number; frais_connexe_paye: number; classe_id: string | null; classes: { id: string; nom: string } | null }>();
    if (schoolYear && rawStudents.length > 0) {
      const { data: enr } = await adminClient
        .from('enrollments')
        .select('student_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, classe_id, classes ( id, nom )')
        .eq('school_year_id', schoolYear.id)
        .in('student_id', rawStudents.map((s) => s.id));
      (enr || []).forEach((e: { student_id: string } & Record<string, unknown>) => enrollmentByStudent.set(e.student_id, e as never));
    }

    const students = rawStudents.map((s) => {
      const en = enrollmentByStudent.get(s.id);
      return {
        ...s,
        niveau: en?.classes?.nom || null,
        classe_id: en?.classe_id || null,
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
        (yearId
          ? adminClient.from('announcements').select('*').eq('school_id', access.school_id).eq('statut', 'publiee').or(`school_year_id.is.null,school_year_id.eq.${yearId}`)
          : adminClient.from('announcements').select('*').eq('school_id', access.school_id).eq('statut', 'publiee').is('school_year_id', null)
        ).order('created_at', { ascending: false }).limit(10),
      ]);

      const subjectsById = new Map((subjects || []).map((s: { id: string }) => [s.id, s]));
      const gradesWithSubject = (grades || []).map((g: { subject_id: string }) => ({ ...g, subject: subjectsById.get(g.subject_id) || null }));
      // Une annonce publiée est visible au parent si elle vise toute
      // l'école, ou la classe de CET élève pour l'année en cours
      // (classe_cible_id, jamais la classe texte historique, non fiable
      // d'une année à l'autre) — et si elle n'est pas expirée.
      const today = new Date().toISOString().slice(0, 10);
      const relevantAnnouncements = (announcements || []).filter(
        (a: { portee: string; classe_cible_id: string | null; date_expiration: string | null }) =>
          (a.portee === 'École entière' || a.classe_cible_id === student.classe_id)
          && (!a.date_expiration || a.date_expiration >= today),
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
