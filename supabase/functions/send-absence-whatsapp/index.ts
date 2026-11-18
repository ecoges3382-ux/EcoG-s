import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // x-api-key reste autorisé : l'app actuelle l'envoie encore, mais il n'est plus utilisé.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Mêmes rôles que ceux qui ont le droit de saisir une absence dans l'app (AbsencesPanel.jsx).
const CAN_DECLARE_ABSENCE_ROLES = ['fondateur', 'directeur', 'censeur', 'secretaire'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Civilité inconnue : on écrit simplement « Bonjour Nom », sans deviner.
function getCivility(civilite: string | null | undefined): string {
  if (!civilite) return '';
  const c = civilite.trim().toLowerCase().replace(/\./g, '');
  if (['mme', 'madame', 'femme', 'f'].includes(c)) return 'Madame';
  if (['m', 'mr', 'monsieur', 'homme'].includes(c)) return 'Monsieur';
  return '';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 🔒 1. Qui appelle ? On vérifie la session de la personne connectée.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Non autorisé : connexion requise.' }, 401);

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: 'Non autorisé : session invalide ou expirée.' }, 401);
    }

    const { data: caller } = await adminClient
      .from('profiles')
      .select('school_id, role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (!caller) return json({ error: 'Non autorisé : profil introuvable.' }, 401);
    if (!CAN_DECLARE_ABSENCE_ROLES.includes(caller.role)) {
      return json({ error: "Interdit : ton rôle ne permet pas d'envoyer des messages d'absence." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { student_id, date, demi_journee, school_id } = body;

    if (!student_id || !school_id) throw new Error("Paramètres manquants.");

    // 🔒 2. Tout doit appartenir à l'école de la personne qui appelle :
    //    le school_id envoyé, et l'élève lui-même.
    if (school_id !== caller.school_id) {
      return json({ error: "Interdit : cette école n'est pas la tienne." }, 403);
    }

    const { data: student } = await adminClient.from('students').select('full_name, school_id').eq('id', student_id).single();
    if (!student) throw new Error("Élève introuvable.");
    if (student.school_id !== caller.school_id) {
      return json({ error: "Interdit : cet élève n'appartient pas à ton école." }, 403);
    }
    const studentName = student.full_name;

    // Mêmes règles que les autres envois WhatsApp : pas de plan Découverte, pas d'école suspendue.
    const { data: school } = await adminClient.from('schools').select('name, plan, statut').eq('id', school_id).single();
    if (!school) throw new Error("École introuvable.");
    if (school.plan === 'decouverte') {
      return json({ ok: true, message: "Le plan Découverte ne permet pas l'envoi de messages WhatsApp." });
    }
    if (school.statut !== 'actif' && school.statut !== 'essai') {
      return json({ ok: true, message: "Le compte de l'école est suspendu ou résilié." });
    }
    const schoolName = school.name || "L'établissement";
    const dial = await getSchoolDial(adminClient, school_id); // indicatif ajouté aux numéros saisis sans « + »

    const { data: links } = await adminClient
      .from('parent_access_students')
      .select('parent_access ( id, full_name, nom, phone, civilite, school_id )')
      .eq('student_id', student_id);

    // Parents de cette école seulement, avec un numéro valide, une seule fois par numéro.
    const seen = new Set<string>();
    const parents: { id: string; full_name: string; civilite: string | null; phone: string }[] = [];
    for (const l of (links || []) as any[]) {
      const p = l.parent_access;
      if (!p || p.school_id !== school_id) continue;
      const phone = normalizePhone(p.phone, dial);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      parents.push({ id: p.id, full_name: p.full_name, civilite: p.civilite, phone });
    }

    if (parents.length === 0) {
      return json({ ok: true, message: "Aucun parent avec numéro de téléphone valide." });
    }

    const { data: config } = await adminClient.from('openwa_configs').select('base_url, session_id').eq('school_id', school_id).eq('statut', 'actif').maybeSingle();
    if (!config) throw new Error("WhatsApp n'est pas configuré pour cette école.");

    const apiKey = Deno.env.get('OPENWA_API_KEY');
    if (!apiKey) throw new Error("Clé API OpenWA manquante.");

    const dateObj = date ? new Date(date) : new Date();
    const dateStr = (isNaN(dateObj.getTime()) ? new Date() : dateObj).toLocaleDateString('fr-FR');
    const moment = demi_journee === 'matin' ? 'ce matin' : demi_journee === 'apres_midi' ? 'cet après-midi' : "aujourd'hui";

    const results = [];

    for (const parent of parents) {
      const civility = getCivility(parent.civilite);
      const greeting = civility ? `Bonjour ${civility} ${parent.full_name},` : `Bonjour ${parent.full_name},`;
      const messageText =
        `${greeting}\n\n` +
        `Nous vous informons que votre enfant *${studentName}* est absent(e) ${moment} (${dateStr}).\n\n` +
        `Si cette absence est justifiée, merci de contacter l'administration.\n\n` +
        `Merci de votre confiance.\n` +
        `${schoolName}`;

      const chatId = `${parent.phone.replace('+', '')}@c.us`;
      const url = `${config.base_url}/api/sessions/${config.session_id}/messages/send-text`;

      let statut: 'envoye' | 'echec' = 'echec';
      let erreur: string | null = null;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify({ chatId, text: messageText }),
        });
        statut = res.ok ? 'envoye' : 'echec';
        erreur = res.ok ? null : `HTTP ${res.status}`;
      } catch (err: any) {
        erreur = err.message;
      }

      // L'historique est écrit dans tous les cas, échecs compris.
      const { error: historyError } = await adminClient.from('whatsapp_messages').insert({
        school_id,
        parent_access_id: parent.id,
        student_id,
        type: 'vie_scolaire',
        destinataire_phone: parent.phone,
        contenu: messageText,
        template_name: 'absence_auto',
        statut,
        erreur,
      });
      if (historyError) console.error('[send-absence-whatsapp] historique non enregistré :', historyError.message);

      results.push({ parent: parent.full_name, status: statut, ...(erreur ? { error: erreur } : {}) });
    }

    return json({ ok: true, results });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
