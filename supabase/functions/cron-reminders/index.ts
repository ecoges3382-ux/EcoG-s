// Edge Function : rappels automatiques d'échéance par WhatsApp (OpenWA), lancée par une tâche planifiée.
//
// Chaque jour, pour chaque école avec OpenWA actif, on prévient les parents dont l'enfant n'a pas encore
// réglé une échéance : 15, 7 et 3 jours avant la date, puis 3 jours après.
//
// Règles de sécurité et de bonne conduite :
//  * seule la tâche planifiée peut l'appeler : elle doit envoyer l'en-tête x-cron-secret (secret CRON_SECRET) ;
//  * « a payé » se calcule comme dans l'application (montants versus échéances), jamais d'après le libellé
//    de tranche d'un paiement ;
//  * les élèves sous moratoire ne sont pas relancés ;
//  * un parent ne reçoit chaque rappel qu'une fois par élève ;
//  * les messages partent un par un, avec une pause de 2 à 5 secondes, jamais en rafale ;
//  * si le temps maximum de la fonction approche, elle s'arrête proprement : la tâche planifiée la relance
//    toutes les 10 minutes le matin, et les messages déjà envoyés ne sont jamais renvoyés.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SITE_URL = 'https://eco-ges.vercel.app';
const MILESTONES = [15, 7, 3, -3];            // jours avant (+) ou après (-) l'échéance : l'ensemble des jalons possibles
const DEDUPE_DAYS = 40;                         // fenêtre où un même rappel ne doit pas être renvoyé
const MAX_FAILURES = 2;                         // au-delà, on arrête de réessayer ce parent pour ce rappel
const TIME_BUDGET_MS = 110_000;                 // la fonction s'arrête avant sa limite de durée
const PAUSE_MIN_MS = 2000;
const PAUSE_RANGE_MS = 3000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Quota mensuel de messages WhatsApp par plan (null = illimité). Copie de src/lib/plan.js : toute évolution là-bas
// doit être répercutée ici (un test vérifie que les deux restent identiques).
const WHATSAPP_QUOTAS: Record<string, number | null> = { decouverte: 0, essentiel: 1000, standard: 3000, premium: null };

function whatsappQuota(plan: string): number | null {
  return Object.prototype.hasOwnProperty.call(WHATSAPP_QUOTAS, plan) ? WHATSAPP_QUOTAS[plan] : 0;
}

// Messages du mois en cours (heure UTC, comme la base). Les échecs ne comptent pas : une école ne perd pas de quota
// parce que son téléphone était déconnecté. Les « en attente » comptent, pour ne pas dépasser en lançant deux envois.
type QuotaState = { quota: number | null; used: number };

// deno-lint-ignore no-explicit-any
async function quotaState(adminClient: any, schoolId: string, plan: string): Promise<QuotaState> {
  const quota = whatsappQuota(plan);
  if (quota === null) return { quota, used: 0 };
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count, error } = await adminClient
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .neq('statut', 'echec')
    .gte('created_at', monthStart);
  if (error || count === null) throw new Error('quota_indisponible');
  return { quota, used: count };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Réglages de l'école (Paramètres > WhatsApp). Copie de reglagesRappels dans src/lib/rappelsAuto.js (tests/rappels-auto.test.js).
// Sans colonnes en base ou sans réglage : tout est activé, comme avant. Un jalon inconnu est ignoré.
// deno-lint-ignore no-explicit-any
function reglagesRappels(row: any) {
  if (!row) return { actif: true, jalons: [...MILESTONES] };
  const brut = Array.isArray(row.rappels_jalons) ? row.rappels_jalons : MILESTONES;
  return { actif: row.rappels_auto !== false, jalons: MILESTONES.filter((j) => brut.includes(j)) };
}

function formatDateFr(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Numéros de téléphone : même logique que src/lib/phone.js (copie, une fonction Deno ne peut pas importer le code de
// l'application ; tests/parite-serveur.test.js vérifie que les deux restent identiques).
// Numéro enregistré (« +229 97 00 00 00 », « 0022997000000 », ou chiffres seuls) -> « +22997000000 », ou null s'il
// est inutilisable. Sans « + » ni « 00 », on ajoute l'indicatif du pays de l'école.
const DEFAULT_DIAL = '229';

function onlyDigits(str: unknown): string {
  return String(str || '').replace(/\D/g, '');
}

function composePhone(dial: string, local: string): string {
  const digits = onlyDigits(local);
  if (!digits) return '';
  if (dial === '229') return `+${dial}${digits.length === 8 ? `01${digits}` : digits}`; // Bénin : « 01 » + 8 chiffres depuis nov. 2024
  if (dial === '225') return `+${dial}${digits}`; // Côte d'Ivoire : préfixe selon l'opérateur, gardé tel quel
  return `+${dial}${digits.replace(/^0+/, '')}`;
}

function normalizePhone(phone: string | null | undefined, dial: string = DEFAULT_DIAL): string | null {
  if (phone === null || phone === undefined) return null;
  let p = String(phone).trim().replace(/[\s().-]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+')) {
    if (!/^\d+$/.test(p)) return null;
    const indicatif = /^\d{1,3}$/.test(String(dial)) ? String(dial) : DEFAULT_DIAL;
    const dejaAvecIndicatif = p.startsWith(indicatif) && p.length >= indicatif.length + 8;
    const local = dejaAvecIndicatif ? p.slice(indicatif.length) : p;
    if (local.length < 7) return null; // trop court pour un numéro : évite d'enregistrer « +22912345 »
    p = composePhone(indicatif, local);
  }
  // Ancien numéro béninois enregistré avec « + » et 8 chiffres (+22997000001) : on y ajoute le « 01 » (réforme du 30 novembre 2024).
  p = p.replace(/^\+229(\d{8})$/, '+22901$1');
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}

// Indicatif du pays de l'école (Paramètres). Si la colonne n'existe pas encore (mise à jour de la base pas faite) ou
// si la lecture échoue, on garde l'indicatif du Bénin, comme avant : jamais une panne d'envoi à cause de ça.
// deno-lint-ignore no-explicit-any
async function getSchoolDial(adminClient: any, schoolId: string): Promise<string> {
  const { data, error } = await adminClient.from('schools').select('indicatif_pays').eq('id', schoolId).maybeSingle();
  if (error || !data?.indicatif_pays || !/^\d{1,3}$/.test(String(data.indicatif_pays))) return DEFAULT_DIAL;
  return String(data.indicatif_pays);
}

// Comparaison sans fuite d'information sur la longueur commune.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// --- Copie de src/lib/retard.js : même calcul que dans l'application ---
const TRANCHE_LABELS: Record<string, string> = { tranche1: '1ère tranche', tranche2: '2ème tranche', tranche3: '3ème tranche' };

function trancheSlots(montantDu: number, feeSchedule: any, nbDelais: number) {
  const bruts = [Number(feeSchedule?.montant_tranche1) || 0, Number(feeSchedule?.montant_tranche2) || 0, Number(feeSchedule?.montant_tranche3) || 0];
  const totalBrut = bruts[0] + bruts[1] + bruts[2];
  const du = Number(montantDu) || 0;
  if (totalBrut > 0) {
    const actifs = [0, 1, 2].filter((i) => bruts[i] > 0);
    const montants = actifs.map((i) => Math.round((bruts[i] / totalBrut) * du));
    const ecart = du - montants.reduce((a, v) => a + v, 0);
    montants[montants.length - 1] += ecart;
    return actifs.map((slotIndex, k) => ({ slotIndex, montant: montants[k] }));
  }
  const n = Math.max(nbDelais, 1);
  const part = Math.round(du / n);
  return Array.from({ length: n }, (_, k) => ({ slotIndex: k, montant: k === n - 1 ? du - part * (n - 1) : part }));
}

function computeEcheances(enrollment: any, schoolYear: any, feeSchedule: any) {
  if (!schoolYear || !enrollment) return [];
  const today = new Date();
  const montantDu = Number(enrollment.montant_du) || 0;
  const montantPayeTotal = Number(enrollment.montant_paye) || 0;
  const datesConfigurees = [schoolYear.date_tranche1, schoolYear.date_tranche2, schoolYear.date_tranche3];
  const nbDelais = datesConfigurees.filter(Boolean).length;
  const slots = trancheSlots(montantDu, feeSchedule, nbDelais);
  let cumulAvant = 0;
  const echeancesScolarite = slots.map(({ slotIndex, montant }, k) => {
    const montantPaye = Math.min(Math.max(montantPayeTotal - cumulAvant, 0), montant);
    const dateLimite = datesConfigurees[slotIndex] || null;
    const isFuture = !!dateLimite && new Date(dateLimite) > today;

    let statut = 'impayee';
    if (montant <= 0 || montantPaye >= montant) statut = 'payee';
    else if (montantPaye > 0) statut = 'partielle';
    else if (isFuture) statut = 'a_venir';

    const enRetard = statut !== 'payee' && statut !== 'a_venir' && !!dateLimite && new Date(dateLimite) < today;
    cumulAvant += montant;
    return { id: `tranche${slotIndex + 1}`, label: TRANCHE_LABELS[`tranche${slotIndex + 1}`] || `Échéance ${k + 1}`, ordre: k + 1, montant, dateLimite, montantPaye, montantRestant: Math.max(montant - montantPaye, 0), statut, enRetard };
  });
  const echeances = [...echeancesScolarite];
  if (schoolYear.date_connexe || Number(enrollment.frais_connexe_du) > 0) {
    const montant = Number(enrollment.frais_connexe_du) || 0;
    const montantPaye = Math.min(Number(enrollment.frais_connexe_paye) || 0, montant);
    const isFuture = !!schoolYear.date_connexe && new Date(schoolYear.date_connexe) > today;

    let statut = 'impayee';
    if (montant <= 0 || montantPaye >= montant) statut = 'payee';
    else if (montantPaye > 0) statut = 'partielle';
    else if (isFuture) statut = 'a_venir';

    const enRetard = statut !== 'payee' && statut !== 'a_venir' && !!schoolYear.date_connexe && new Date(schoolYear.date_connexe) < today;
    echeances.push({ id: 'connexe', label: 'Frais connexes', ordre: echeancesScolarite.length + 1, montant, dateLimite: schoolYear.date_connexe || null, montantPaye, montantRestant: Math.max(montant - montantPaye, 0), statut, enRetard });
  }
  return echeances;
}

function buildMessage(args: { civilite: string; nom: string; label: string; verbe: string; studentName: string; date: string; jours: number; code: string | null }): string {
  const { civilite, nom, label, verbe, studentName, date, jours, code } = args;
  const lien = code ? `${SITE_URL}/parent-access?code=${code}` : `${SITE_URL}/parent-access`;
  const salut = `Bonjour ${civilite ? civilite + ' ' : ''}${nom}`;
  if (jours >= 0) {
    return `${salut}, ${label} de ${studentName} ${verbe} à échéance le ${formatDateFr(date)}. Vous pouvez consulter le détail ici : ${lien}`;
  }
  return `${salut}, nous n'avons pas encore reçu le paiement pour ${label} de ${studentName}, dont l'échéance était fixée au ${formatDateFr(date)}. Merci de bien vouloir régulariser votre situation. Vous pouvez consulter le détail ici : ${lien}`;
}

async function sendOpenWAText(
  config: { base_url: string; session_id: string },
  apiKey: string,
  toPhone: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${config.base_url}/api/sessions/${config.session_id}/messages/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ chatId: `${toPhone.replace('+', '')}@c.us`, text }),
    });
    if (!res.ok) return { ok: false, error: `OpenWA HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur réseau vers OpenWA.' };
  }
}

// Formule de politesse et nom de l'école, ajoutés en bas de tout message envoyé aux parents.
function withSignature(text: string, schoolName: string | null | undefined): string {
  const name = (schoolName || '').trim();
  const base = String(text || '').trimEnd();
  if (!name) return `${base}\n\nMerci de votre confiance.`;
  if (base.endsWith(name)) return base; // déjà signé
  return `${base}\n\nMerci de votre confiance.\n${name}`;
}

type Job = {
  schoolId: string;
  config: { base_url: string; session_id: string };
  studentId: string;
  parentId: string;
  phone: string;
  templateName: string;
  message: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 🔒 Seule la tâche planifiée connaît ce secret.
    const expected = Deno.env.get('CRON_SECRET');
    if (!expected) return jsonResponse({ error: "CRON_SECRET n'est pas configuré sur le serveur." }, 500);
    const given = req.headers.get('x-cron-secret') ?? '';
    if (!safeEqual(given, expected)) return jsonResponse({ error: 'Non autorisé.' }, 401);

    const startedAt = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('OPENWA_API_KEY');
    if (!apiKey) return jsonResponse({ error: "La clé API OpenWA n'est pas configurée." }, 500);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: configs } = await adminClient.from('openwa_configs').select('school_id, base_url, session_id').eq('statut', 'actif');
    if (!configs || configs.length === 0) return jsonResponse({ ok: true, sent: 0, failed: 0, remaining: 0, message: 'Aucune configuration OpenWA active.' });

    // 1. On prépare la liste des messages à envoyer, pour toutes les écoles.
    const jobs: Job[] = [];
    let alreadySent = 0;
    let quotaSkipped = 0; // rappels non envoyés parce que le quota du mois est atteint
    for (const config of configs) {
      const schoolId = config.school_id as string;
      const { data: school } = await adminClient.from('schools').select('plan, statut, name').eq('id', schoolId).single();
      if (!school || school.plan === 'decouverte' || (school.statut !== 'actif' && school.statut !== 'essai')) continue;

      // Le fondateur peut couper les rappels ou choisir ses jalons. Lecture à part : si les colonnes n'existent pas encore
      // (mise à jour de la base pas faite), on garde le comportement d'avant, jamais une panne d'envoi à cause de ça.
      const { data: reglagesRow, error: reglagesError } = await adminClient.from('schools').select('rappels_auto, rappels_jalons').eq('id', schoolId).maybeSingle();
      const reglages = reglagesRappels(reglagesError ? null : reglagesRow);
      if (!reglages.actif || reglages.jalons.length === 0) continue;

      const dial = await getSchoolDial(adminClient, schoolId); // indicatif ajouté aux numéros saisis sans « + »
      const { data: schoolYears } = await adminClient
        .from('school_years')
        .select('id, date_tranche1, date_tranche2, date_tranche3, date_connexe')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .limit(1);
      if (!schoolYears || schoolYears.length === 0) continue;
      const schoolYear = schoolYears[0];

      const milestones = [
        { type: 'tranche1', date: schoolYear.date_tranche1, label: "la 1ère tranche de l'écolage", verbe: 'arrive' },
        { type: 'tranche2', date: schoolYear.date_tranche2, label: "la 2ème tranche de l'écolage", verbe: 'arrive' },
        { type: 'tranche3', date: schoolYear.date_tranche3, label: "la 3ème tranche de l'écolage", verbe: 'arrive' },
        { type: 'connexe', date: schoolYear.date_connexe, label: 'les frais connexes', verbe: 'arrivent' },
      ]
        .map((e) => ({ ...e, jours: daysUntil(e.date) }))
        .filter((e) => e.jours !== null && reglages.jalons.includes(e.jours as number));
      if (milestones.length === 0) continue;

      // Quota du mois : au-delà, les rappels de cette école attendent le mois suivant (jamais d'envoi hors quota).
      // Si le quota ne peut pas être lu, on n'envoie rien pour cette école ce tour-ci : la prochaine exécution réessaie.
      let reste: number | null = null;
      try {
        const q = await quotaState(adminClient, schoolId, school.plan as string);
        reste = q.quota === null ? null : Math.max(q.quota - q.used, 0);
      } catch {
        console.warn('[cron-reminders] quota illisible, école ignorée ce tour-ci :', schoolId);
        continue;
      }
      if (reste !== null && reste <= 0) {
        quotaSkipped++;
        console.warn('[cron-reminders] quota WhatsApp du mois atteint, rappels suspendus pour l\'école :', schoolId);
        continue;
      }

      // Données de l'école, chargées une seule fois.
      const { data: enrollments } = await adminClient
        .from('enrollments')
        .select('student_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, moratoire_actif, classes ( niveau ), students ( id, full_name )')
        .eq('school_year_id', schoolYear.id);
      if (!enrollments || enrollments.length === 0) continue;

      const { data: fees } = await adminClient.from('fee_schedules').select('niveau, montant_tranche1, montant_tranche2, montant_tranche3').eq('school_year_id', schoolYear.id);
      // deno-lint-ignore no-explicit-any
      const feeByNiveau: Record<string, any> = {};
      // deno-lint-ignore no-explicit-any
      (fees || []).forEach((f: any) => { feeByNiveau[f.niveau] = f; });

      // deno-lint-ignore no-explicit-any
      const parentsByStudent: Record<string, any[]> = {};
      for (const ids of chunk(enrollments.map((e: { student_id: string }) => e.student_id), 150)) {
        const { data: links } = await adminClient
          .from('parent_access_students')
          .select('student_id, parent_access ( id, full_name, nom, phone, code, civilite, school_id )')
          .in('student_id', ids);
        // deno-lint-ignore no-explicit-any
        (links || []).forEach((l: any) => {
          const p = l.parent_access;
          if (!p || p.school_id !== schoolId) return;
          const phone = normalizePhone(p.phone, dial);
          if (!phone) return;
          (parentsByStudent[l.student_id] = parentsByStudent[l.student_id] || []).push({ ...p, phone });
        });
      }

      // Rappels déjà envoyés (ou en cours) dans la fenêtre : un parent ne reçoit un même rappel qu'une fois par élève.
      const templateNames = milestones.map((m) => `rappel_j${m.jours}_${m.type}`);
      const since = new Date(Date.now() - DEDUPE_DAYS * 86400000).toISOString();
      const { data: history } = await adminClient
        .from('whatsapp_messages')
        .select('parent_access_id, student_id, template_name, statut')
        .eq('school_id', schoolId)
        .in('template_name', templateNames)
        .gte('created_at', since);
      const done = new Set<string>();
      const failures: Record<string, number> = {};
      const planned = new Set<string>();
      // deno-lint-ignore no-explicit-any
      (history || []).forEach((m: any) => {
        const key = `${m.parent_access_id}:${m.student_id}:${m.template_name}`;
        if (m.statut === 'echec') failures[key] = (failures[key] || 0) + 1;
        else done.add(key);
      });

      for (const ms of milestones) {
        const templateName = `rappel_j${ms.jours}_${ms.type}`;
        // deno-lint-ignore no-explicit-any
        for (const enr of enrollments as any[]) {
          const student = enr.students;
          if (!student) continue;
          // Moratoire en cours : l'école a convenu d'un arrangement, on ne relance pas.
          // Même règle que src/lib/retard.js : une note d'arrangement ou un moratoire actif exclut la famille.
          if (enr.note_arrangement && String(enr.note_arrangement).trim() !== '') continue;
          if (enr.moratoire_actif === true) continue;

          // Cette échéance est-elle réellement impayée ? Même calcul que l'application.
          const echeances = computeEcheances(enr, schoolYear, enr.classes?.niveau ? feeByNiveau[enr.classes.niveau] : null);
          const echeance = echeances.find((e) => e.id === ms.type);
          if (!echeance || echeance.statut === 'payee') continue;

          for (const parent of parentsByStudent[student.id] || []) {
            const key = `${parent.id}:${student.id}:${templateName}`;
            if (planned.has(key)) continue;
            if (done.has(key)) { alreadySent++; continue; }
            if ((failures[key] || 0) >= MAX_FAILURES) continue;
            if (reste !== null) { if (reste <= 0) { quotaSkipped++; continue; } reste--; }
            const civilite = parent.civilite === 'Mme' ? 'Madame' : (parent.civilite === 'M' ? 'Monsieur' : '');
            jobs.push({
              schoolId,
              config: { base_url: config.base_url, session_id: config.session_id },
              studentId: student.id,
              parentId: parent.id,
              phone: parent.phone,
              templateName,
              message: withSignature(buildMessage({ civilite, nom: parent.nom || parent.full_name, label: ms.label, verbe: ms.verbe, studentName: student.full_name, date: ms.date as string, jours: ms.jours as number, code: parent.code }), school.name),
            });
            planned.add(key); // un même parent relié deux fois à l'élève ne reçoit qu'un message
          }
        }
      }
    }

    // 2. Envoi, un message à la fois, avec une pause : jamais de rafale.
    let sent = 0;
    let failed = 0;
    let processed = 0;
    for (const job of jobs) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break; // la prochaine exécution reprendra ici
      // On écrit l'historique AVANT d'envoyer : si l'écriture échoue, on n'envoie pas.
      const { data: inserted, error: insertError } = await adminClient
        .from('whatsapp_messages')
        .insert({
          school_id: job.schoolId, parent_access_id: job.parentId, student_id: job.studentId,
          type: 'relance_paiement', destinataire_phone: job.phone, contenu: job.message,
          template_name: job.templateName, statut: 'en_attente', created_by: null,
        })
        .select('id')
        .single();
      processed++;
      if (insertError || !inserted) { failed++; continue; }

      const result = await sendOpenWAText(job.config, apiKey, job.phone, job.message);
      if (result.ok) {
        sent++;
        await adminClient.from('whatsapp_messages').update({ statut: 'envoye', updated_at: new Date().toISOString() }).eq('id', inserted.id);
      } else {
        failed++;
        await adminClient.from('whatsapp_messages').update({ statut: 'echec', erreur: result.error, updated_at: new Date().toISOString() }).eq('id', inserted.id);
      }
      if (processed < jobs.length) await sleep(PAUSE_MIN_MS + Math.random() * PAUSE_RANGE_MS);
    }

    return jsonResponse({ ok: true, sent, failed, remaining: jobs.length - processed, already_sent: alreadySent, quota_skipped: quotaSkipped });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
