// Edge Function : consultation par un parent, via son code d'accès.
//
// Contrairement aux autres Edge Functions de l'appli, celle-ci n'exige
// aucune identité appelante (pas de compte, pas de session) — le "mot de
// passe" est le code lui-même. Elle tourne avec la clé service_role pour
// pouvoir lire au-delà de la RLS (un parent n'a par définition aucun rôle
// reconnu par la base), mais ne renvoie jamais que les données des élèves
// effectivement rattachés au code fourni, et calcule elle-même toutes les
// autorisations (jamais un student_id ou school_year_id fourni par le
// navigateur pris comme preuve d'accès sans vérification serveur).
//
// Toute la logique de moyenne/classement de bulletin est importée de
// src/lib/bulletin.js (même source que Grades.jsx côté admin) — jamais une
// deuxième implémentation du calcul. Le classement a besoin des notes des
// camarades de classe pour se calculer ; ce calcul reste donc côté serveur
// (ici) et ne renvoie au parent que le rang final, jamais l'identité ou les
// notes des autres élèves.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { PERIODES_BULLETIN, computeRang } from '../../../src/lib/bulletin.js';

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

type SchoolYearRow = {
  id: string;
  label: string;
  statut: string;
  is_current: boolean;
  school_id: string;
  date_tranche1: string | null;
  date_tranche2: string | null;
  date_tranche3: string | null;
  date_connexe: string | null;
};

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

    // Les seuls élèves que ce code autorise à consulter — toute la suite ne
    // travaille plus qu'à partir de cette liste, jamais d'un id fourni tel
    // quel par le client.
    const rawStudents = (access.parent_access_students || [])
      .map((row: { students: unknown }) => row.students)
      .filter(Boolean) as { id: string; full_name: string; photo_url: string | null; matricule: string | null; moyenne: number | null; bulletin_pret: boolean }[];

    const { data: schoolYear } = await adminClient
      .from('school_years')
      .select('id, label, statut, is_current, school_id, date_tranche1, date_tranche2, date_tranche3, date_connexe')
      .eq('school_id', access.school_id)
      .eq('is_current', true)
      .maybeSingle();

    // La classe et le dû/payé d'un élève sont propres à l'année scolaire en
    // cours (table enrollments) — students ne garde que son identité.
    const enrollmentByStudent = new Map<string, {
      montant_du: number; montant_paye: number; frais_connexe_du: number; frais_connexe_paye: number;
      statut: string; note_arrangement: string | null; classe_id: string | null; classes: { id: string; nom: string; niveau: string } | null;
    }>();
    if (schoolYear && rawStudents.length > 0) {
      const { data: enr } = await adminClient
        .from('enrollments')
        .select('student_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, statut, note_arrangement, classe_id, classes ( id, nom, niveau )')
        .eq('school_year_id', schoolYear.id)
        .in('student_id', rawStudents.map((s) => s.id));
      (enr || []).forEach((e: { student_id: string } & Record<string, unknown>) => enrollmentByStudent.set(e.student_id, e as never));
    }

    // Le contenu exact d'une note d'arrangement peut porter des remarques
    // internes du personnel — jamais montré tel quel au parent, seulement le
    // fait qu'un arrangement existe (utile pour ne pas relancer à tort).
    const students = rawStudents.map((s) => {
      const en = enrollmentByStudent.get(s.id);
      return {
        ...s,
        niveau: en?.classes?.nom || null,
        // "niveau" ci-dessus est le NOM de la classe (ex. "6ème A", pour
        // l'affichage) — classe_niveau est le niveau pédagogique
        // (classes.niveau, ex. "6ème"), seule clé valable pour retrouver
        // une ligne de fee_schedules (voir StudentDetail.jsx côté admin).
        classe_niveau: en?.classes?.niveau || null,
        classe_id: en?.classe_id || null,
        statut_inscription: en?.statut || null,
        has_arrangement: !!(en?.note_arrangement && en.note_arrangement.trim()),
        montant_du: en?.montant_du ?? 0,
        montant_paye: en?.montant_paye ?? 0,
        frais_connexe_du: en?.frais_connexe_du ?? 0,
        frais_connexe_paye: en?.frais_connexe_paye ?? 0,
      };
    });

    if (body.action === 'detail') {
      const student = students.find((s) => s.id === body.student_id);
      if (!student) throw new Error("Cet élève n'est pas rattaché à ce code.");

      // Années auxquelles CET élève a réellement une inscription — jamais
      // une année simplement parce qu'elle existe pour l'école, jamais une
      // année 'preparation' (pas encore une année scolaire ordinaire), et
      // jamais une année d'une autre école.
      const { data: enrYears } = await adminClient
        .from('enrollments')
        .select('school_years ( id, label, statut, is_current, school_id, date_tranche1, date_tranche2, date_tranche3, date_connexe )')
        .eq('student_id', student.id);
      const years = ((enrYears || []).map((r: { school_years: unknown }) => r.school_years).filter(Boolean) as SchoolYearRow[])
        .filter((y) => y.school_id === access.school_id && y.statut !== 'preparation')
        .sort((a, b) => (a.is_current === b.is_current ? b.label.localeCompare(a.label) : a.is_current ? -1 : 1));

      // Année consultée : celle demandée si l'élève y a effectivement une
      // inscription (jamais un id accepté sans ce contrôle), sinon l'année
      // active par défaut.
      let targetYear: SchoolYearRow | null = null;
      if (body.school_year_id) {
        targetYear = years.find((y) => y.id === body.school_year_id) || null;
        if (!targetYear) throw new Error("Cette année scolaire n'est pas accessible pour cet élève.");
      } else {
        targetYear = years.find((y) => y.is_current) || null;
      }

      if (!targetYear) {
        return jsonResponse({ full_name: access.full_name, student, years, school_year: null, enrollment: null, payments: [], attendance: [], grades: [], subjects: [], rangs: null, fee_schedule: null, announcements: [] });
      }

      const { data: enr } = await adminClient
        .from('enrollments')
        .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, statut, note_arrangement, classe_id, classes ( id, nom, niveau )')
        .eq('student_id', student.id)
        .eq('school_year_id', targetYear.id)
        .maybeSingle();

      const niveau = enr?.classes?.niveau || null;
      const today = new Date().toISOString().slice(0, 10);

      const [{ data: payments }, { data: attendance }, { data: subjects }, { data: myGrades }, { data: feeSchedule }, { data: classmateEnrollments }, { data: announcements }] = await Promise.all([
        adminClient.from('payments').select('id, montant, type_frais, mode, tranche, date, note').eq('student_id', student.id).eq('school_year_id', targetYear.id).order('date', { ascending: false }),
        adminClient.from('attendance_records').select('date, statut').eq('student_id', student.id).eq('school_year_id', targetYear.id).order('date', { ascending: false }),
        adminClient.from('subjects').select('id, nom, coefficient, niveau').eq('school_id', access.school_id),
        adminClient.from('grades').select('student_id, subject_id, note, sur, periode').eq('student_id', student.id).eq('school_year_id', targetYear.id),
        niveau
          ? adminClient.from('fee_schedules').select('*').eq('school_year_id', targetYear.id).eq('niveau', niveau).maybeSingle()
          : Promise.resolve({ data: null }),
        enr?.classe_id
          ? adminClient.from('enrollments').select('student_id').eq('school_year_id', targetYear.id).eq('classe_id', enr.classe_id)
          : Promise.resolve({ data: [] as { student_id: string }[] }),
        adminClient.from('announcements').select('*').eq('school_id', access.school_id).eq('statut', 'publiee').or(`school_year_id.is.null,school_year_id.eq.${targetYear.id}`).order('created_at', { ascending: false }).limit(20),
      ]);

      const subjectsById = new Map((subjects || []).map((s: { id: string }) => [s.id, s]));
      const gradesWithSubject = (myGrades || []).map((g: { subject_id: string }) => ({ ...g, subject: subjectsById.get(g.subject_id) || null }));
      const subjectsForNiveau = (subjects || []).filter((s: { niveau: string | null }) => !s.niveau || s.niveau === niveau);

      // Classement : calculé côté serveur à partir des notes de TOUTE la
      // classe (même formule que le bulletin admin, src/lib/bulletin.js),
      // mais seul le rang final quitte la fonction — jamais les notes ou
      // l'identité des camarades.
      const classmateIds = (classmateEnrollments || []).map((e: { student_id: string }) => e.student_id);
      let rangs: Record<string, { rang: number; total: number } | null> | null = null;
      if (classmateIds.length > 0 && niveau) {
        const { data: classGrades } = await adminClient
          .from('grades')
          .select('student_id, subject_id, note, sur, periode')
          .eq('school_year_id', targetYear.id)
          .in('student_id', classmateIds);
        rangs = {};
        for (const p of [...PERIODES_BULLETIN, 'annuel']) {
          rangs[p] = computeRang(subjectsForNiveau, classGrades || [], classmateIds, student.id, p);
        }
      }

      // Une annonce publiée est visible au parent si elle vise toute
      // l'école, ou la classe de CET élève pour l'année consultée
      // (classe_cible_id, jamais la classe texte historique, non fiable
      // d'une année à l'autre) — et si elle n'est pas expirée.
      const relevantAnnouncements = (announcements || []).filter(
        (a: { portee: string; classe_cible_id: string | null; date_expiration: string | null }) =>
          (a.portee === 'École entière' || a.classe_cible_id === enr?.classe_id)
          && (!a.date_expiration || a.date_expiration >= today),
      );

      return jsonResponse({
        full_name: access.full_name,
        student,
        years,
        school_year: targetYear,
        enrollment: enr
          ? {
              montant_du: enr.montant_du,
              montant_paye: enr.montant_paye,
              frais_connexe_du: enr.frais_connexe_du,
              frais_connexe_paye: enr.frais_connexe_paye,
              statut: enr.statut,
              has_arrangement: !!(enr.note_arrangement && enr.note_arrangement.trim()),
              classe: enr.classes ? { id: enr.classes.id, nom: enr.classes.nom, niveau: enr.classes.niveau } : null,
            }
          : null,
        fee_schedule: feeSchedule || null,
        payments: payments || [],
        attendance: attendance || [],
        grades: gradesWithSubject,
        subjects: subjectsForNiveau,
        rangs,
        announcements: relevantAnnouncements,
      });
    }

    // --- Résumé (écran d'accueil) : tous les enfants, année active ---
    let feeSchedules: unknown[] = [];
    let recentAnnouncements: unknown[] = [];
    const attendanceAlerts = new Map<string, { absences: number; retards: number }>();
    if (schoolYear && rawStudents.length > 0) {
      const niveaux = [...new Set(students.map((s) => s.classe_niveau).filter(Boolean) as string[])];
      const classeIds = [...new Set(students.map((s) => s.classe_id).filter(Boolean) as string[])];
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: fs }, { data: ann }, { data: att }] = await Promise.all([
        niveaux.length
          ? adminClient.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id).in('niveau', niveaux)
          : Promise.resolve({ data: [] as unknown[] }),
        adminClient.from('announcements').select('*').eq('school_id', access.school_id).eq('statut', 'publiee').or(`school_year_id.is.null,school_year_id.eq.${schoolYear.id}`).order('created_at', { ascending: false }).limit(20),
        // Une seule requête groupée pour tous les enfants plutôt qu'une par
        // enfant — reste performant même avec une fratrie nombreuse.
        adminClient.from('attendance_records').select('student_id, statut').eq('school_year_id', schoolYear.id).in('student_id', rawStudents.map((s) => s.id)).neq('statut', 'present').gte('date', since),
      ]);
      feeSchedules = fs || [];
      recentAnnouncements = ((ann || []) as { portee: string; classe_cible_id: string | null; date_expiration: string | null }[])
        .filter((a) => (a.portee === 'École entière' || (a.classe_cible_id && classeIds.includes(a.classe_cible_id))) && (!a.date_expiration || a.date_expiration >= today))
        .slice(0, 3);
      (att || []).forEach((r: { student_id: string; statut: string }) => {
        const c = attendanceAlerts.get(r.student_id) || { absences: 0, retards: 0 };
        if (r.statut === 'absent') c.absences += 1;
        else if (r.statut === 'retard') c.retards += 1;
        attendanceAlerts.set(r.student_id, c);
      });
    }

    const studentsWithAlerts = students.map((s) => ({
      ...s,
      absences_recentes: attendanceAlerts.get(s.id)?.absences || 0,
      retards_recents: attendanceAlerts.get(s.id)?.retards || 0,
    }));

    return jsonResponse({
      full_name: access.full_name,
      students: studentsWithAlerts,
      school_year: schoolYear,
      fee_schedules: feeSchedules,
      announcements: recentAnnouncements,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
