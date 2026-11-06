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

// ... (Les fonctions trancheSlots, computeEcheances et buildRelanceMessage restent inchangées) ...
// (Je les ai raccourcies ici pour la lisibilité, gardez celles de votre fichier actuel)
function trancheSlots(montantDu: number, feeSchedule: any, nbDelais: number) { /* ... */ return []; }
function computeEcheances(enrollment: any, schoolYear: any, feeSchedule: any) { /* ... */ return []; }
function buildRelanceMessage(params: any): string { /* ... */ return ""; }

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

    const { data: schoolData, error: schoolError } = await adminClient.from('schools').select('plan, statut').eq('id', schoolId).single();
    if (schoolError || !schoolData) throw new Error("Impossible de vérifier le plan de votre école.");
    if (schoolData.plan === 'decouverte') throw new Error("Votre plan Découverte ne permet pas l'envoi de messages WhatsApp.");
    if (schoolData.statut !== 'actif' && schoolData.statut !== 'essai') throw new Error("Le compte de votre école est suspendu ou résilié.");

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
       // ... (Gardez votre code actuel pour les relances) ...
       return jsonResponse({ ok: true, results }); 

    } else if (type === 'annonce') {
       const announcementId = body.announcement_id;
       const { data: ann } = await adminClient.from('announcements').select('titre, contenu, audience, portee, classe_cible_id').eq('id', announcementId).single();
       if (!ann) throw new Error("Annonce introuvable.");
       
       messageText = `Annonce : ${ann.titre}\n\n${ann.contenu || ''}`;

       const audiences = ann.audience || ['parents'];
       let recipients: { id: string, phone: string }[] = [];

       // 1. Destinataires Parents
       if (audiences.includes('parents')) {
         let parents: any[] = [];
         if (ann.portee === 'Une classe' && ann.classe_cible_id) {
           const { data: enrollments } = await adminClient
             .from('enrollments')
             .select('student_id')
             .eq('school_year_id', body.school_year_id || ann.school_year_id)
             .eq('classe_id', ann.classe_cible_id);

           if (enrollments && enrollments.length > 0) {
             const studentIds = enrollments.map(e => e.student_id);
             const { data: links } = await adminClient
               .from('parent_access_students')
               .select('parent_access ( id, phone )')
               .in('student_id', studentIds);
             
             if (links) {
               links.forEach((l: any) => {
                 if (l.parent_access && l.parent_access.phone) parents.push(l.parent_access);
               });
             }
           }
         } else {
           const { data: allParents } = await adminClient.from('parent_access').select('id, phone').eq('school_id', schoolId);
           if (allParents) parents = allParents;
         }
         
         parents.forEach(p => {
           if (!recipients.find(r => r.phone === p.phone)) {
             recipients.push({ id: p.id, phone: p.phone });
           }
         });
       }

       // 2. Destinataires Personnel (Enseignants, Équipe, Tout)
       let targetRoles: string[] = [];
       if (audiences.includes('personnel')) targetRoles = ['fondateur', 'directeur', 'secretaire', 'enseignant'];
       else {
         if (audiences.includes('enseignants')) targetRoles.push('enseignant');
         if (audiences.includes('equipe')) targetRoles.push('fondateur', 'directeur', 'secretaire');
       }

       if (targetRoles.length > 0) {
         const { data: staff } = await adminClient
           .from('profiles')
           .select('id, phone')
           .eq('school_id', schoolId)
           .in('role', targetRoles)
           .not('phone', 'is', null);
         
         if (staff) {
           staff.forEach(s => {
             if (s.phone && !recipients.find(r => r.phone === s.phone)) {
               recipients.push({ id: s.id, phone: s.phone });
             }
           });
         }
       }

       if (recipients.length === 0) {
         return jsonResponse({ ok: true, results: [{ statut: 'echec', erreur: 'Aucun destinataire trouvé (numéros manquants ?)' }] });
       }

       for (const r of recipients) {
          const { data: inserted } = await adminClient.from('whatsapp_messages').insert({
             school_id: schoolId, 
             parent_access_id: audiences.includes('parents') && recipients.find(x => x.phone === r.phone) ? r.id : null, 
             student_id: null, 
             announcement_id: announcementId,
             type: type, 
             destinataire_phone: r.phone, 
             contenu: messageText, 
             template_name: 'openwa_free_text',
             statut: 'en_attente', 
             created_by: user.id,
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
       // ... (Gardez votre code actuel pour les messages individuels) ...
       return jsonResponse({ ok: true, results });
    }

  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
