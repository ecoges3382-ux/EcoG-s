// Edge Function : couche serveur UNIQUE d'envoi WhatsApp (Meta Cloud API).
//
// Le frontend n'appelle jamais l'API Meta directement et ne voit jamais le
// jeton d'accès d'une école — il envoie une demande métier (type, élève ou
// annonce concerné) et cette fonction, seule, se charge de : vérifier
// l'appelant, vérifier son école, vérifier son droit d'envoyer, récupérer la
// configuration WhatsApp de CETTE école (jamais celle d'une autre, jamais
// via un id fourni par le client), reconstruire les données réelles
// (montant dû, échéance, contenu d'annonce) côté serveur, envoyer, et
// n'enregistrer un message "envoyé" que si le fournisseur l'a confirmé.
//
// Le calcul des échéances ci-dessous est une COPIE FIDÈLE de
// src/lib/retard.js (computeEcheances/trancheSlots) — les Edge Functions de
// ce projet sont déployées par copier-coller dans le dashboard Supabase,
// pas par la CLI, donc un import relatif vers le code du frontend ne se
// résoudrait pas. Toute évolution de la logique d'échéance côté frontend
// doit être répercutée ici à la main.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CAN_SEND_ROLES = ['fondateur', 'directeur', 'secretaire'];
const MESSAGE_TYPES = ['relance_paiement', 'echeance', 'annonce', 'vie_scolaire', 'message_individuel'];
const COOLDOWN_SECONDS = 60;
const GRAPH_API_VERSION = 'v20.0';

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

function fmtF(n: number): string {
  const v = Math.round(Number(n) || 0);
  return `${v.toLocaleString('fr-FR')} F CFA`;
}

// --- Copie fidèle de src/lib/retard.js (voir en-tête du fichier) ---
const TRANCHE_LABELS: Record<string, string> = { tranche1: '1ère tranche', tranche2: '2ème tranche', tranche3: '3ème tranche' };

function trancheSlots(montantDu: number, feeSchedule: { montant_tranche1?: number; montant_tranche2?: number; montant_tranche3?: number } | null, nbDelais: number) {
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

type Echeance = { id: string; label: string; ordre: number; montant: number; dateLimite: string | null; montantPaye: number; montantRestant: number; statut: string; enRetard: boolean };

function computeEcheances(
  enrollment: { montant_du: number; montant_paye: number; frais_connexe_du?: number; frais_connexe_paye?: number },
  schoolYear: { date_tranche1: string | null; date_tranche2: string | null; date_tranche3: string | null; date_connexe: string | null } | null,
  feeSchedule: { montant_tranche1?: number; montant_tranche2?: number; montant_tranche3?: number } | null,
): Echeance[] {
  if (!schoolYear || !enrollment) return [];
  const today = new Date();
  const montantDu = Number(enrollment.montant_du) || 0;
  const montantPayeTotal = Number(enrollment.montant_paye) || 0;

  const datesConfigurees = [schoolYear.date_tranche1, schoolYear.date_tranche2, schoolYear.date_tranche3];
  const nbDelais = datesConfigurees.filter(Boolean).length;
  const slots = trancheSlots(montantDu, feeSchedule, nbDelais);

  let cumulAvant = 0;
  const echeancesScolarite: Echeance[] = slots.map(({ slotIndex, montant }, k) => {
    const montantPaye = Math.min(Math.max(montantPayeTotal - cumulAvant, 0), montant);
    const statut = montant <= 0 ? 'payee' : montantPaye >= montant ? 'payee' : montantPaye > 0 ? 'partielle' : 'impayee';
    const dateLimite = datesConfigurees[slotIndex] || null;
    const enRetard = statut !== 'payee' && !!dateLimite && new Date(dateLimite) < today;
    cumulAvant += montant;
    return {
      id: `tranche${slotIndex + 1}`,
      label: TRANCHE_LABELS[`tranche${slotIndex + 1}`] || `Échéance ${k + 1}`,
      ordre: k + 1,
      montant, dateLimite, montantPaye,
      montantRestant: Math.max(montant - montantPaye, 0),
      statut, enRetard,
    };
  });

  const echeances = [...echeancesScolarite];
  if (schoolYear.date_connexe || Number(enrollment.frais_connexe_du) > 0) {
    const montant = Number(enrollment.frais_connexe_du) || 0;
    const montantPaye = Math.min(Number(enrollment.frais_connexe_paye) || 0, montant);
    const statut = montant <= 0 ? 'payee' : montantPaye >= montant ? 'payee' : montantPaye > 0 ? 'partielle' : 'impayee';
    const enRetard = statut !== 'payee' && !!schoolYear.date_connexe && new Date(schoolYear.date_connexe) < today;
    echeances.push({ id: 'connexe', label: 'Frais connexes', ordre: echeancesScolarite.length + 1, montant, dateLimite: schoolYear.date_connexe || null, montantPaye, montantRestant: Math.max(montant - montantPaye, 0), statut, enRetard });
  }
  return echeances;
}
// --- fin de la copie ---

function isValidE164(phone: string | null | undefined): boolean {
  return !!phone && /^\+[1-9]\d{6,14}$/.test(phone);
}

async function sendWhatsAppTemplate(
  config: { phone_number_id: string; access_token: string },
  toPhone: string,
  templateName: string,
  templateLang: string,
  params: string[],
): Promise<{ ok: true; providerMessageId: string | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang || 'fr' },
          components: params.length ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: String(p) })) }] : [],
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `Erreur du fournisseur (HTTP ${res.status}).` };
    }
    return { ok: true, providerMessageId: data?.messages?.[0]?.id || null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur réseau vers le fournisseur WhatsApp.' };
  }
}

// deno-lint-ignore no-explicit-any
async function checkCooldown(adminClient: any, schoolId: string, studentId: string | null, type: string): Promise<string | null> {
  if (!studentId) return null;
  const since = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
  const { data } = await adminClient
    .from('whatsapp_messages')
    .select('id')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('type', type)
    .in('statut', ['en_attente', 'envoye'])
    .gte('created_at', since)
    .limit(1);
  return data && data.length > 0
    ? "Un message de ce type vient déjà d'être envoyé pour cet élève — réessaie dans une minute."
    : null;
}

// deno-lint-ignore no-explicit-any
async function checkQuota(adminClient: any, schoolId: string, quota: number): Promise<{ used: number; remaining: number }> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await adminClient
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .gte('created_at', since);
  const used = count || 0;
  return { used, remaining: Math.max(quota - used, 0) };
}

type SendOutcome = { parent_access_id: string; phone: string; statut: 'envoye' | 'echec'; erreur?: string };

// deno-lint-ignore no-explicit-any
async function sendAndLog(
  adminClient: any,
  row: { school_id: string; parent_access_id: string | null; student_id: string | null; announcement_id: string | null; type: string; destinataire_phone: string; contenu: string; template_name: string; created_by: string },
  config: { phone_number_id: string; access_token: string },
  templateLang: string,
  params: string[],
): Promise<SendOutcome> {
  const { data: inserted, error: insertError } = await adminClient
    .from('whatsapp_messages')
    .insert({ ...row, statut: 'en_attente' })
    .select('id')
    .single();
  if (insertError || !inserted) {
    return { parent_access_id: row.parent_access_id || '', phone: row.destinataire_phone, statut: 'echec', erreur: 'Historique indisponible, envoi annulé par prudence.' };
  }

  const result = await sendWhatsAppTemplate(config, row.destinataire_phone, row.template_name, templateLang, params);
  if (result.ok) {
    await adminClient.from('whatsapp_messages').update({ statut: 'envoye', provider_message_id: result.providerMessageId, updated_at: new Date().toISOString() }).eq('id', inserted.id);
    return { parent_access_id: row.parent_access_id || '', phone: row.destinataire_phone, statut: 'envoye' };
  }
  await adminClient.from('whatsapp_messages').update({ statut: 'echec', erreur: result.error, updated_at: new Date().toISOString() }).eq('id', inserted.id);
  return { parent_access_id: row.parent_access_id || '', phone: row.destinataire_phone, statut: 'echec', erreur: result.error };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non authentifié.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error('Non authentifié.');

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('school_id, role, full_name')
      .eq('id', user.id)
      .single();
    if (profileError || !callerProfile) throw new Error('Profil introuvable.');
    if (!CAN_SEND_ROLES.includes(callerProfile.role)) {
      throw new Error("Vous n'avez pas le droit d'envoyer des messages WhatsApp.");
    }

    const body = await req.json();
    const type = body.type;
    if (!MESSAGE_TYPES.includes(type)) throw new Error('Type de message invalide.');

    const adminClient = createClient(supabaseUrl, serviceKey);
    const schoolId = callerProfile.school_id as string;

    const { data: config } = await adminClient
      .from('whatsapp_configs')
      .select('phone_number_id, access_token, templates, quota_quotidien, statut')
      .eq('school_id', schoolId)
      .maybeSingle();
    if (!config || config.statut !== 'actif' || !config.phone_number_id || !config.access_token) {
      throw new Error("WhatsApp n'est pas configuré pour votre école. Configure-le depuis Paramètres → WhatsApp.");
    }

    const templateConf = (config.templates || {})[type];
    if (!templateConf?.name) {
      throw new Error(`Aucun template WhatsApp approuvé n'est configuré pour « ${type} ». Configure-le dans Paramètres → WhatsApp.`);
    }

    const quota = await checkQuota(adminClient, schoolId, config.quota_quotidien || 200);
    if (quota.remaining <= 0) {
      throw new Error('Quota quotidien de messages WhatsApp atteint pour votre école — réessaie demain.');
    }

    // ---------- relance_paiement / echeance ----------
    if (type === 'relance_paiement' || type === 'echeance') {
      const studentId = body.student_id;
      if (!studentId) throw new Error('Élève manquant.');

      const cooldownError = await checkCooldown(adminClient, schoolId, studentId, type);
      if (cooldownError) throw new Error(cooldownError);

      // Jamais un élève d'une autre école : le filtre school_id fait partie
      // de la requête elle-même, pas une vérification après coup.
      const { data: student } = await adminClient.from('students').select('id, full_name').eq('id', studentId).eq('school_id', schoolId).maybeSingle();
      if (!student) throw new Error("Élève introuvable pour votre école.");

      const { data: schoolYear } = await adminClient.from('school_years').select('id, date_tranche1, date_tranche2, date_tranche3, date_connexe').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
      if (!schoolYear) throw new Error("Aucune année scolaire active.");

      const { data: enrollment } = await adminClient
        .from('enrollments')
        .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, classe_id, classes ( nom, niveau )')
        .eq('student_id', studentId)
        .eq('school_year_id', schoolYear.id)
        .maybeSingle();
      if (!enrollment) throw new Error("Cet élève n'a pas d'inscription pour l'année en cours.");

      let feeSchedule = null;
      if (enrollment.classes?.niveau) {
        const { data: fs } = await adminClient.from('fee_schedules').select('montant_tranche1, montant_tranche2, montant_tranche3').eq('school_year_id', schoolYear.id).eq('niveau', enrollment.classes.niveau).maybeSingle();
        feeSchedule = fs;
      }

      // Le serveur recalcule TOUT à partir des vraies données — jamais un
      // montant fourni par le frontend.
      const echeances = computeEcheances(enrollment, schoolYear, feeSchedule);
      const cible = type === 'relance_paiement'
        ? echeances.find((e) => e.statut !== 'payee' && e.enRetard)
        : echeances.find((e) => e.statut !== 'payee');
      if (!cible) {
        throw new Error(type === 'relance_paiement'
          ? 'Aucune échéance en retard pour cet élève — inutile de relancer.'
          : 'Toutes les échéances sont déjà réglées pour cet élève.');
      }

      const { data: links } = await adminClient.from('parent_access_students').select('parent_access ( id, full_name, phone, school_id )').eq('student_id', studentId);
      const parents = (links || []).map((l: { parent_access: unknown }) => l.parent_access).filter((p: { school_id?: string }) => p && p.school_id === schoolId) as { id: string; full_name: string; phone: string | null }[];
      if (parents.length === 0) throw new Error('Aucun parent relié à cet élève.');
      const withPhone = parents.filter((p) => isValidE164(p.phone));
      if (withPhone.length === 0) throw new Error("Aucun des parents reliés n'a de numéro WhatsApp valide enregistré.");

      const seenPhones = new Set<string>();
      const results: SendOutcome[] = [];
      for (const parent of withPhone) {
        if (seenPhones.has(parent.phone as string)) continue; // doublon évident (même numéro relié deux fois)
        seenPhones.add(parent.phone as string);
        const params = [parent.full_name, student.full_name, fmtF(cible.montant), fmtF(cible.montantRestant), cible.dateLimite ? new Date(cible.dateLimite).toLocaleDateString('fr-FR') : '—'];
        const outcome = await sendAndLog(
          adminClient,
          { school_id: schoolId, parent_access_id: parent.id, student_id: studentId, announcement_id: null, type, destinataire_phone: parent.phone as string, contenu: `${cible.label} · ${fmtF(cible.montantRestant)} restant`, template_name: templateConf.name, created_by: user.id },
          { phone_number_id: config.phone_number_id, access_token: config.access_token },
          templateConf.lang || 'fr',
          params,
        );
        results.push(outcome);
      }

      return jsonResponse({ ok: true, results });
    }

    // ---------- annonce ----------
    if (type === 'annonce') {
      const announcementId = body.announcement_id;
      if (!announcementId) throw new Error('Annonce manquante.');

      const { data: announcement } = await adminClient.from('announcements').select('id, school_id, statut, portee, classe_cible_id, school_year_id, titre, contenu').eq('id', announcementId).eq('school_id', schoolId).maybeSingle();
      if (!announcement) throw new Error('Annonce introuvable pour votre école.');
      if (announcement.statut !== 'publiee') throw new Error('Seule une annonce publiée peut être diffusée par WhatsApp.');

      // Diffusion déjà lancée récemment pour cette annonce précise : on ne
      // relance pas une deuxième vague en cas de double clic.
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: already } = await adminClient.from('whatsapp_messages').select('id').eq('announcement_id', announcementId).in('statut', ['en_attente', 'envoye']).gte('created_at', since).limit(1);
      if (already && already.length > 0) throw new Error('Une diffusion WhatsApp de cette annonce vient déjà d\'être lancée.');

      let recipients: { id: string; phone: string }[] = [];
      if (announcement.portee === 'École entière') {
        const { data } = await adminClient.from('parent_access').select('id, phone').eq('school_id', schoolId);
        recipients = (data || []) as { id: string; phone: string }[];
      } else if (announcement.classe_cible_id) {
        let yearId = announcement.school_year_id;
        if (!yearId) {
          const { data: sy } = await adminClient.from('school_years').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
          yearId = sy?.id || null;
        }
        if (yearId) {
          const { data: enr } = await adminClient.from('enrollments').select('student_id').eq('school_year_id', yearId).eq('classe_id', announcement.classe_cible_id);
          const studentIds = (enr || []).map((e: { student_id: string }) => e.student_id);
          if (studentIds.length) {
            const { data: links } = await adminClient.from('parent_access_students').select('parent_access ( id, phone, school_id )').in('student_id', studentIds);
            const seen = new Set<string>();
            for (const l of (links || []) as { parent_access: { id: string; phone: string; school_id: string } | null }[]) {
              const pa = l.parent_access;
              if (pa && pa.school_id === schoolId && !seen.has(pa.id)) { seen.add(pa.id); recipients.push({ id: pa.id, phone: pa.phone }); }
            }
          }
        }
      }

      const seenPhones = new Set<string>();
      const withPhone = recipients.filter((r) => isValidE164(r.phone) && !seenPhones.has(r.phone) && seenPhones.add(r.phone));
      if (withPhone.length === 0) throw new Error('Aucun destinataire avec un numéro WhatsApp valide pour cette annonce.');

      const toSend = withPhone.slice(0, quota.remaining);
      const skippedQuota = withPhone.length - toSend.length;

      const params = [`${announcement.titre}${announcement.contenu ? ' — ' + announcement.contenu : ''}`];
      let envoyes = 0, echecs = 0;
      for (const r of toSend) {
        const outcome = await sendAndLog(
          adminClient,
          { school_id: schoolId, parent_access_id: r.id, student_id: null, announcement_id: announcementId, type, destinataire_phone: r.phone, contenu: announcement.titre, template_name: templateConf.name, created_by: user.id },
          { phone_number_id: config.phone_number_id, access_token: config.access_token },
          templateConf.lang || 'fr',
          params,
        );
        if (outcome.statut === 'envoye') envoyes++; else echecs++;
      }

      return jsonResponse({ ok: true, total: withPhone.length, envoyes, echecs, skipped_quota: skippedQuota });
    }

    // ---------- vie_scolaire / message_individuel ----------
    {
      let parentAccessId = body.parent_access_id;
      const studentId = body.student_id || null;
      const contenu = typeof body.contenu === 'string' ? body.contenu.trim() : '';
      if (!contenu) throw new Error('Le contenu du message est obligatoire.');

      if (!parentAccessId && studentId) {
        const { data: links } = await adminClient.from('parent_access_students').select('parent_access ( id, school_id )').eq('student_id', studentId).limit(1);
        const first = (links || [])[0] as { parent_access: { id: string; school_id: string } | null } | undefined;
        if (first?.parent_access && first.parent_access.school_id === schoolId) parentAccessId = first.parent_access.id;
      }
      if (!parentAccessId) throw new Error('Destinataire manquant.');

      const { data: parent } = await adminClient.from('parent_access').select('id, phone, school_id').eq('id', parentAccessId).eq('school_id', schoolId).maybeSingle();
      if (!parent) throw new Error('Ce parent ne fait pas partie de votre école.');
      if (!isValidE164(parent.phone)) throw new Error("Ce parent n'a pas de numéro WhatsApp valide enregistré.");

      if (studentId) {
        const cooldownError = await checkCooldown(adminClient, schoolId, studentId, type);
        if (cooldownError) throw new Error(cooldownError);
      }

      const outcome = await sendAndLog(
        adminClient,
        { school_id: schoolId, parent_access_id: parent.id, student_id: studentId, announcement_id: null, type, destinataire_phone: parent.phone, contenu, template_name: templateConf.name, created_by: user.id },
        { phone_number_id: config.phone_number_id, access_token: config.access_token },
        templateConf.lang || 'fr',
        [contenu],
      );

      return jsonResponse({ ok: true, results: [outcome] });
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
