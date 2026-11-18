// Edge Function : envoi WhatsApp via OpenWA (notre serveur WhatsApp, utilisé quand l'école a une
// configuration OpenWA active ; sinon l'app passe par whatsapp-send, l'API officielle Meta).
//
// Le frontend envoie une demande métier (type, élève, annonce ou parent). Cette fonction vérifie
// l'appelant, son école, son rôle et son plan, reconstruit elle-même les montants à partir de la base
// (jamais un montant fourni par le navigateur), envoie, et ne note « envoyé » que si OpenWA a confirmé.
//
// Le calcul des échéances est une copie de src/lib/retard.js : toute évolution là-bas doit être
// répercutée ici.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CAN_SEND_ROLES = ['fondateur', 'directeur', 'secretaire'];
const MESSAGE_TYPES = ['relance_paiement', 'echeance', 'annonce', 'vie_scolaire', 'message_individuel'];
const SITE_URL = 'https://eco-ges.vercel.app';
// Même durée que whatsapp-send : empêche d'envoyer deux fois le même message par un double clic.
const COOLDOWN_SECONDS = 60;

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
  return `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} F CFA`;
}

// Numéro enregistré (« +229 97 00 00 00 », « 0022997000000 »...) -> « +22997000000 », ou null s'il est inutilisable.
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = String(phone).trim().replace(/[\s().-]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}


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

function buildRelanceMessage(params: {
  parentFullName: string;
  parentNom: string;
  lienParente: string;
  studentName: string;
  code: string;
  echeances: any[];
  calendrierConfigure: boolean;
}): string {
  const { parentNom, lienParente, studentName, code, echeances, calendrierConfigure } = params;

  let dues: any[];
  if (calendrierConfigure) {
    dues = echeances.filter((e) => e.statut !== 'payee' && e.enRetard);
  } else {
    dues = echeances.filter((e) => e.statut !== 'payee');
  }

  const tranchesDues = dues.filter((e) => e.id.startsWith('tranche'));
  const connexeDu = dues.find((e) => e.id === 'connexe');
  const montantDu = dues.reduce((acc, e) => acc + (Number(e.montantRestant) || 0), 0);

  const formatTranches = (arr: any[]) => {
    if (arr.length === 1) return arr[0].label.toLowerCase();
    if (arr.length === 2) return `${arr[0].label.toLowerCase()} et ${arr[1].label.toLowerCase()}`;
    return `${arr[0].label.toLowerCase()}, ${arr[1].label.toLowerCase()} et ${arr[2].label.toLowerCase()}`;
  };

  let dueText = '';
  if (tranchesDues.length > 0 && connexeDu) {
    const isPlural = tranchesDues.length > 1;
    dueText = `${isPlural ? 'Les' : 'La'} ${formatTranches(tranchesDues)} ainsi que les frais connexes sont arrivés à échéance. `;
  } else if (tranchesDues.length > 0) {
    const isPlural = tranchesDues.length > 1;
    dueText = `${isPlural ? 'Les' : 'La'} ${formatTranches(tranchesDues)} ${isPlural ? 'sont arrivées' : 'est arrivée'} à échéance. `;
  } else if (connexeDu) {
    dueText = `Les frais connexes sont arrivés à échéance. `;
  }

  let accroche = '';
  const aEcolage = tranchesDues.length > 0;
  const aConnexe = !!connexeDu;

  if (aEcolage && aConnexe) {
    accroche = `au sujet de la scolarité et des frais connexes de ${studentName}`;
  } else if (aConnexe) {
    accroche = `au sujet des frais connexes de ${studentName}`;
  } else if (aEcolage) {
    accroche = `au sujet de la scolarité de ${studentName}`;
  } else {
    accroche = `au sujet de la scolarité de ${studentName}`;
  }

  const civilite = lienParente === 'pere' ? 'Monsieur' : (lienParente === 'mere' ? 'Madame' : '');
  const prefix = civilite ? `${civilite} ` : '';
  const nomAffiche = parentNom || params.parentFullName;

  const montantText = montantDu > 0 ? `Le montant restant à payer est de ${fmtF(montantDu)}. ` : '';
  const lien = code ? `${SITE_URL}/parent-access?code=${code}` : `${SITE_URL}/parent-access`;

  return `Bonjour ${prefix}${nomAffiche}, nous vous contactons ${accroche}. ${dueText}${montantText}Vous pouvez consulter le détail ici : ${lien}`;
}

async function sendOpenWAText(
  config: { base_url: string; session_id: string; api_key: string },
  toPhone: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const chatId = `${toPhone.replace('+', '')}@c.us`;
    const url = `${config.base_url}/api/sessions/${config.session_id}/messages/send-text`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': config.api_key },
      body: JSON.stringify({ chatId, text }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `OpenWA HTTP ${res.status}: ${errorText}` };
    }
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

type Outcome = { parent_access_id: string | null; phone: string; statut: 'envoye' | 'echec'; erreur?: string };

// Écrit la ligne d'historique AVANT d'envoyer (« en_attente »), envoie, puis note le résultat réel.
// Si l'historique ne peut pas être écrit, on n'envoie pas : un message parti sans trace est pire qu'un échec.
// deno-lint-ignore no-explicit-any
async function sendAndLog(adminClient: any, openwa: { base_url: string; session_id: string; api_key: string; school_name: string }, row: Record<string, unknown> & { destinataire_phone: string; contenu: string }): Promise<Outcome> {
  const parentId = (row.parent_access_id as string | null) ?? null;
  const contenu = withSignature(row.contenu, openwa.school_name); // ce qui est envoyé est aussi ce qui est enregistré
  const { data: inserted, error: insertError } = await adminClient
    .from('whatsapp_messages')
    .insert({ ...row, contenu, template_name: 'openwa_free_text', statut: 'en_attente' })
    .select('id')
    .single();
  if (insertError || !inserted) {
    return { parent_access_id: parentId, phone: row.destinataire_phone, statut: 'echec', erreur: 'Historique indisponible, envoi annulé par prudence.' };
  }
  const result = await sendOpenWAText(openwa, row.destinataire_phone, contenu);
  if (result.ok) {
    await adminClient.from('whatsapp_messages').update({ statut: 'envoye', updated_at: new Date().toISOString() }).eq('id', inserted.id);
    return { parent_access_id: parentId, phone: row.destinataire_phone, statut: 'envoye' };
  }
  await adminClient.from('whatsapp_messages').update({ statut: 'echec', erreur: result.error, updated_at: new Date().toISOString() }).eq('id', inserted.id);
  return { parent_access_id: parentId, phone: row.destinataire_phone, statut: 'echec', erreur: result.error };
}

// Même type de message pour le même élève depuis moins d'une minute : on refuse.
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
    ? "Un message de ce type vient déjà d'être envoyé pour cet élève. Réessaie dans une minute."
    : null;
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

    const { data: callerProfile } = await callerClient.from('profiles').select('school_id, role, full_name').eq('id', user.id).single();
    if (!callerProfile) throw new Error('Profil introuvable.');
    if (!CAN_SEND_ROLES.includes(callerProfile.role)) throw new Error("Vous n'avez pas le droit d'envoyer des messages.");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const schoolId = callerProfile.school_id as string;

    // Plan et état du compte de l'école
    const { data: schoolData, error: schoolError } = await adminClient.from('schools').select('plan, statut, name').eq('id', schoolId).single();
    if (schoolError || !schoolData) throw new Error('Impossible de vérifier le plan de votre école.');
    if (schoolData.plan === 'decouverte') throw new Error("Votre plan Découverte ne permet pas l'envoi de messages WhatsApp. Passez à un plan supérieur (Essentiel, Standard ou Premium).");
    if (schoolData.statut !== 'actif' && schoolData.statut !== 'essai') throw new Error('Le compte de votre école est suspendu ou résilié. Contactez le support.');

    const body = await req.json().catch(() => ({}));
    const type = body.type;
    if (!MESSAGE_TYPES.includes(type)) throw new Error('Type de message invalide.');

    const { data: config } = await adminClient.from('openwa_configs').select('base_url, session_id').eq('school_id', schoolId).eq('statut', 'actif').maybeSingle();
    if (!config) throw new Error("OpenWA n'est pas configuré pour votre école.");

    const apiKey = Deno.env.get('OPENWA_API_KEY');
    if (!apiKey) throw new Error("La clé API OpenWA n'est pas configurée dans les secrets Supabase.");
    const openwa = { base_url: config.base_url, session_id: config.session_id, api_key: apiKey, school_name: schoolData.name as string };

    // ---------- relance de paiement / rappel d'échéance ----------
    if (type === 'relance_paiement' || type === 'echeance') {
      const studentId = body.student_id;
      if (!studentId) throw new Error('Élève manquant.');

      const cooldownError = await checkCooldown(adminClient, schoolId, studentId, type);
      if (cooldownError) throw new Error(cooldownError);

      // Jamais un élève d'une autre école : le filtre fait partie de la requête.
      const { data: student } = await adminClient.from('students').select('id, full_name').eq('id', studentId).eq('school_id', schoolId).maybeSingle();
      if (!student) throw new Error('Élève introuvable pour votre école.');

      const { data: schoolYear } = await adminClient.from('school_years').select('id, date_tranche1, date_tranche2, date_tranche3, date_connexe').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
      if (!schoolYear) throw new Error('Aucune année scolaire active.');

      const { data: enrollment } = await adminClient
        .from('enrollments')
        .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, classes ( niveau )')
        .eq('student_id', studentId)
        .eq('school_year_id', schoolYear.id)
        .maybeSingle();
      if (!enrollment) throw new Error("Cet élève n'a pas d'inscription pour l'année en cours.");

      let feeSchedule = null;
      if (enrollment.classes?.niveau) {
        const { data: fs } = await adminClient.from('fee_schedules').select('montant_tranche1, montant_tranche2, montant_tranche3').eq('school_year_id', schoolYear.id).eq('niveau', enrollment.classes.niveau).maybeSingle();
        feeSchedule = fs;
      }

      // Le serveur recalcule tout à partir des vraies données.
      const calendrierConfigure = !!(schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3 || schoolYear.date_connexe);
      const echeances = computeEcheances(enrollment, schoolYear, feeSchedule);
      const aRelancer = echeances.filter((e) => e.statut !== 'payee' && (calendrierConfigure ? e.enRetard : true));
      if (aRelancer.length === 0) {
        throw new Error(type === 'relance_paiement'
          ? 'Aucune échéance en retard pour cet élève : inutile de relancer.'
          : 'Toutes les échéances sont déjà réglées pour cet élève.');
      }

      const { data: links } = await adminClient.from('parent_access_students').select('parent_access ( id, full_name, nom, phone, code, lien_parente, school_id )').eq('student_id', studentId);
      // deno-lint-ignore no-explicit-any
      const parents = (links || []).map((l: any) => l.parent_access).filter((p: any) => p && p.school_id === schoolId);
      if (parents.length === 0) throw new Error('Aucun parent relié à cet élève.');
      // deno-lint-ignore no-explicit-any
      const withPhone = parents.map((p: any) => ({ ...p, phone: normalizePhone(p.phone) })).filter((p: any) => p.phone);
      if (withPhone.length === 0) throw new Error("Aucun des parents reliés n'a de numéro WhatsApp valide enregistré.");

      const seenPhones = new Set<string>();
      const results: Outcome[] = [];
      for (const parent of withPhone) {
        if (seenPhones.has(parent.phone)) continue; // même numéro relié deux fois
        seenPhones.add(parent.phone);
        const text = buildRelanceMessage({
          parentFullName: parent.full_name,
          parentNom: parent.nom,
          lienParente: parent.lien_parente,
          studentName: student.full_name,
          code: parent.code,
          echeances,
          calendrierConfigure,
        });
        results.push(await sendAndLog(adminClient, openwa, {
          school_id: schoolId, parent_access_id: parent.id, student_id: studentId, announcement_id: null,
          type, destinataire_phone: parent.phone, contenu: text, created_by: user.id,
        }));
      }
      return jsonResponse({ ok: true, results });
    }

    // ---------- annonce ----------
    if (type === 'annonce') {
      const announcementId = body.announcement_id;
      if (!announcementId) throw new Error('Annonce manquante.');

      // Jamais l'annonce d'une autre école.
      const { data: ann } = await adminClient
        .from('announcements')
        .select('id, titre, contenu, audience, portee, classe_cible_id, school_year_id, statut')
        .eq('id', announcementId)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (!ann) throw new Error('Annonce introuvable pour votre école.');
      if (ann.statut !== 'publiee') throw new Error('Seule une annonce publiée peut être diffusée par WhatsApp.');

      // Diffusion déjà lancée à l'instant (double clic) : on ne fait pas une deuxième vague.
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: already } = await adminClient.from('whatsapp_messages').select('id').eq('announcement_id', announcementId).in('statut', ['en_attente', 'envoye']).gte('created_at', since).limit(1);
      if (already && already.length > 0) throw new Error("Une diffusion WhatsApp de cette annonce vient déjà d'être lancée.");

      const messageText = `Annonce : ${ann.titre}\n\n${ann.contenu || ''}`;
      const audiences: string[] = ann.audience || ['parents'];
      const recipients: { id: string; phone: string; isParent: boolean }[] = [];
      const addRecipient = (id: string, rawPhone: string | null, isParent: boolean) => {
        const phone = normalizePhone(rawPhone);
        if (phone && !recipients.find((r) => r.phone === phone)) recipients.push({ id, phone, isParent });
      };

      // 1. Parents
      if (audiences.includes('parents')) {
        if (ann.portee === 'Une classe' && ann.classe_cible_id) {
          // Année : celle de l'annonce, sinon celle de la demande, sinon l'année en cours.
          let yearId = ann.school_year_id || body.school_year_id || null;
          if (!yearId) {
            const { data: sy } = await adminClient.from('school_years').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
            yearId = sy?.id || null;
          }
          if (yearId) {
            const { data: enrollments } = await adminClient.from('enrollments').select('student_id').eq('school_year_id', yearId).eq('classe_id', ann.classe_cible_id);
            const studentIds = (enrollments || []).map((e: { student_id: string }) => e.student_id);
            if (studentIds.length > 0) {
              const { data: links } = await adminClient.from('parent_access_students').select('parent_access ( id, phone, school_id )').in('student_id', studentIds);
              // deno-lint-ignore no-explicit-any
              (links || []).forEach((l: any) => { if (l.parent_access && l.parent_access.school_id === schoolId) addRecipient(l.parent_access.id, l.parent_access.phone, true); });
            }
          }
        } else {
          const { data: allParents } = await adminClient.from('parent_access').select('id, phone').eq('school_id', schoolId);
          (allParents || []).forEach((p: { id: string; phone: string }) => addRecipient(p.id, p.phone, true));
        }
      }

      // 2. Personnel
      let targetRoles: string[] = [];
      if (audiences.includes('personnel')) targetRoles = ['fondateur', 'directeur', 'secretaire', 'enseignant'];
      else {
        if (audiences.includes('enseignants')) targetRoles.push('enseignant');
        if (audiences.includes('equipe')) targetRoles.push('fondateur', 'directeur', 'secretaire');
      }
      if (targetRoles.length > 0) {
        const { data: staff } = await adminClient.from('profiles').select('id, phone').eq('school_id', schoolId).in('role', targetRoles).not('phone', 'is', null);
        (staff || []).forEach((s: { id: string; phone: string }) => addRecipient(s.id, s.phone, false));
      }

      if (recipients.length === 0) throw new Error('Aucun destinataire avec un numéro WhatsApp valide pour cette annonce.');

      // Envoi par lots de 20 pour ne pas dépasser le temps maximum de la fonction.
      const results: Outcome[] = [];
      const CHUNK_SIZE = 20;
      for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
        const chunk = recipients.slice(i, i + CHUNK_SIZE);
        const outcomes = await Promise.all(chunk.map((r) => sendAndLog(adminClient, openwa, {
          school_id: schoolId, parent_access_id: r.isParent ? r.id : null, student_id: null, announcement_id: announcementId,
          type, destinataire_phone: r.phone, contenu: messageText, created_by: user.id,
        })));
        results.push(...outcomes);
      }
      const envoyes = results.filter((r) => r.statut === 'envoye').length;
      // Même forme de réponse que whatsapp-send (Meta) : l'écran Annonces lit total / envoyes / echecs.
      return jsonResponse({ ok: true, total: results.length, envoyes, echecs: results.length - envoyes, results });
    }

    // ---------- message individuel / vie scolaire ----------
    {
      const contenu = typeof body.contenu === 'string' ? body.contenu.trim() : '';
      if (!contenu) throw new Error('Le contenu du message est obligatoire.');
      const parentAccessId = body.parent_access_id;
      if (!parentAccessId) throw new Error('Destinataire manquant.');
      const studentId = body.student_id || null;

      // Jamais un parent d'une autre école.
      const { data: parent } = await adminClient.from('parent_access').select('id, phone').eq('id', parentAccessId).eq('school_id', schoolId).maybeSingle();
      if (!parent) throw new Error('Ce parent ne fait pas partie de votre école.');
      const phone = normalizePhone(parent.phone);
      if (!phone) throw new Error("Ce parent n'a pas de numéro WhatsApp valide enregistré.");

      if (studentId) {
        const cooldownError = await checkCooldown(adminClient, schoolId, studentId, type);
        if (cooldownError) throw new Error(cooldownError);
      }

      const outcome = await sendAndLog(adminClient, openwa, {
        school_id: schoolId, parent_access_id: parent.id, student_id: studentId, announcement_id: null,
        type, destinataire_phone: phone, contenu, created_by: user.id,
      });
      return jsonResponse({ ok: true, results: [outcome] });
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
