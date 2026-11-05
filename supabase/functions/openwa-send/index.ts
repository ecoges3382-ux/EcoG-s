import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CAN_SEND_ROLES = ['fondateur', 'directeur', 'secretaire'];
const MESSAGE_TYPES = ['relance_paiement', 'echeance', 'annonce', 'vie_scolaire', 'message_individuel'];
const SITE_URL = 'https://eco-ges.vercel.app';

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
  const lien = `${SITE_URL}/parent-access?code=${code}`;

  return `Bonjour ${prefix}${nomAffiche}, nous vous contactons ${accroche}. ${dueText}${montantText}Vous pouvez consulter le détail ici : ${lien}`;
}

async function sendOpenWAText(
  config: { base_url: string; session_id: string; api_key: string },
  toPhone: string,
  text: string
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

    // 👇 NOUVELLE SÉCURITÉ : Vérification du plan de l'école
    const { data: schoolData, error: schoolError } = await adminClient
      .from('schools')
      .select('plan, statut')
      .eq('id', schoolId)
      .single();

    if (schoolError || !schoolData) {
      throw new Error("Impossible de vérifier le plan de votre école.");
    }

    if (schoolData.plan === 'decouverte') {
      throw new Error("Votre plan Découverte ne permet pas l'envoi de messages WhatsApp. Passez à un plan supérieur (Essentiel, Standard ou Premium).");
    }

    if (schoolData.statut !== 'actif' && schoolData.statut !== 'essai') {
      throw new Error("Le compte de votre école est suspendu ou résilié. Contactez le support.");
    }
    // 👆 FIN DE LA SÉCURITÉ

    const body = await req.json();
    const type = body.type;
    if (!MESSAGE_TYPES.includes(type)) throw new Error('Type de message invalide.');

    const { data: config } = await adminClient.from('openwa_configs').select('base_url, session_id').eq('school_id', schoolId).eq('statut', 'actif').maybeSingle();
    if (!config) throw new Error("OpenWA n'est pas configuré pour votre école.");

    const apiKey = Deno.env.get('OPENWA_API_KEY');
    if (!apiKey) throw new Error("La clé API OpenWA n'est pas configurée dans les secrets Supabase.");

    let results: { statut: 'envoye' | 'echec', erreur?: string }[] = [];
    let messageText = '';

    if (type === 'relance_paiement' || type === 'echeance') {
       const studentId = body.student_id;
       const { data: student } = await adminClient.from('students').select('full_name').eq('id', studentId).eq('school_id', schoolId).single();

       const { data: links } = await adminClient.from('parent_access_students').select('parent_access ( id, full_name, nom, phone, code, lien_parente )').eq('student_id', studentId);
       if (!links || links.length === 0) throw new Error("Aucun parent relié à cet élève.");

       const { data: schoolYear } = await adminClient.from('school_years').select('id, date_tranche1, date_tranche2, date_tranche3, date_connexe').eq('school_id', schoolId).eq('is_current', true).maybeSingle();

       let echeances: any[] = [];
       let calendrierConfigure = false;

       if (schoolYear) {
         calendrierConfigure = !!(schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3 || schoolYear.date_connexe);
         const { data: enrollment } = await adminClient
           .from('enrollments')
           .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, classes ( niveau )')
           .eq('student_id', studentId)
           .eq('school_year_id', schoolYear.id)
           .maybeSingle();

         if (enrollment) {
           let feeSchedule = null;
           if (enrollment.classes?.niveau) {
             const { data: fs } = await adminClient.from('fee_schedules').select('montant_tranche1, montant_tranche2, montant_tranche3').eq('school_year_id', schoolYear.id).eq('niveau', enrollment.classes.niveau).maybeSingle();
             feeSchedule = fs;
           }
           echeances = computeEcheances(enrollment, schoolYear, feeSchedule);
         }
       }

       for (const link of links) {
          const parent = link.parent_access;
          if (!parent || !parent.phone) continue;

          const text = buildRelanceMessage({
            parentFullName: parent.full_name,
            parentNom: parent.nom,
            lienParente: parent.lien_parente,
            studentName: student.full_name,
            code: parent.code,
            echeances,
            calendrierConfigure,
          });

          const { data: inserted } = await adminClient.from('whatsapp_messages').insert({
             school_id: schoolId,
             parent_access_id: parent.id,
             student_id: studentId,
             announcement_id: null,
             type: type,
             destinataire_phone: parent.phone,
             contenu: text,
             template_name: 'openwa_free_text',
             statut: 'en_attente',
             created_by: user.id,
          }).select('id').single();

          if (!inserted) {
             results.push({ statut: 'echec', erreur: 'Erreur insertion en base' });
             continue;
          }

          const result = await sendOpenWAText({ base_url: config.base_url, session_id: config.session_id, api_key: apiKey }, parent.phone, text);

          if (result.ok) {
            await adminClient.from('whatsapp_messages').update({ statut: 'envoye', updated_at: new Date().toISOString() }).eq('id', inserted.id);
            results.push({ statut: 'envoye' });
          } else {
            await adminClient.from('whatsapp_messages').update({ statut: 'echec', erreur: result.error, updated_at: new Date().toISOString() }).eq('id', inserted.id);
            results.push({ statut: 'echec', erreur: result.error });
          }
       }

       return jsonResponse({ ok: true, results });

    } else if (type === 'annonce') {
       const announcementId = body.announcement_id;
       const { data: ann } = await adminClient.from('announcements').select('titre, contenu').eq('id', announcementId).single();
       messageText = `Annonce : ${ann.titre}\n\n${ann.contenu || ''}`;
       const { data: parents } = await adminClient.from('parent_access').select('id, phone').eq('school_id', schoolId);
       const recipients = (parents || []).filter((p: any) => p.phone).map((p: any) => ({ id: p.id, phone: p.phone }));

       for (const r of recipients) {
          const { data: inserted } = await adminClient.from('whatsapp_messages').insert({
             school_id: schoolId, parent_access_id: r.id, student_id: null, announcement_id: announcementId,
             type: type, destinataire_phone: r.phone, contenu: messageText, template_name: 'openwa_free_text',
             statut: 'en_attente', created_by: user.id,
          }).select('id').single();

          if (!inserted) { results.push({ statut: 'echec', erreur: 'Erreur insertion' }); continue; }

          const result = await sendOpenWAText({ base_url: config.base_url, session_id: config.session_id, api_key: apiKey }, r.phone, messageText);
          if (result.ok) {
             await adminClient.from('whatsapp_messages').update({ statut: 'envoye', updated_at: new Date().toISOString() }).eq('id', inserted.id);
             results.push({ statut: 'envoye' });
          } else {
             await adminClient.from('whatsapp_messages').update({ statut: 'echec', erreur: result.error, updated_at: new Date().toISOString() }).eq('id', inserted.id);
             results.push({ statut: 'echec', erreur: result.error });
          }
       }
       return jsonResponse({ ok: true, results });

    } else {
       messageText = body.contenu || '';
       const parentAccessId = body.parent_access_id;
       const { data: parent } = await adminClient.from('parent_access').select('id, phone').eq('id', parentAccessId).single();

       if (!messageText.trim()) throw new Error('Message vide.');
       if (!parent) throw new Error('Parent introuvable.');

       const { data: inserted } = await adminClient.from('whatsapp_messages').insert({
          school_id: schoolId, parent_access_id: parent.id, student_id: null, announcement_id: null,
          type: type, destinataire_phone: parent.phone, contenu: messageText, template_name: 'openwa_free_text',
          statut: 'en_attente', created_by: user.id,
       }).select('id').single();

       if (!inserted) throw new Error('Erreur insertion');

       const result = await sendOpenWAText({ base_url: config.base_url, session_id: config.session_id, api_key: apiKey }, parent.phone, messageText);
       if (result.ok) {
          await adminClient.from('whatsapp_messages').update({ statut: 'envoye', updated_at: new Date().toISOString() }).eq('id', inserted.id);
          results.push({ statut: 'envoye' });
       } else {
          await adminClient.from('whatsapp_messages').update({ statut: 'echec', erreur: result.error, updated_at: new Date().toISOString() }).eq('id', inserted.id);
          results.push({ statut: 'echec', erreur: result.error });
       }
       return jsonResponse({ ok: true, results });
    }

  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
