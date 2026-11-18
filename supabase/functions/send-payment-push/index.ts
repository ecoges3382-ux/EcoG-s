import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmtAmount(n: number) {
  return Math.round(Number(n) || 0).toLocaleString('de-DE');
}

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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) throw new Error("VAPID manquant.");
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // ==========================================
    // 🔒 SÉCURITÉ : Vérification de l'utilisateur connecté
    // ==========================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Non autorisé : Token manquant.");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));

    if (authError || !user) throw new Error("Non autorisé : Token invalide.");

    const body = await req.json();
    const { school_id, student_id, student_name, amount, type_frais, date } = body;
    if (!school_id || !student_name || !amount) throw new Error("Paramètres manquants.");

    // Vérifier que l'utilisateur appartient bien à cette école et a le droit de gérer les paiements
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, permissions, school_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.school_id !== school_id) {
      throw new Error("Non autorisé : Vous n'appartenez pas à cette école.");
    }

    const hasFinanceAccess = profile.role === 'fondateur' || profile.role === 'directeur' || profile.role === 'secretaire' || profile.permissions?.finance === true;
    if (!hasFinanceAccess) {
      throw new Error("Non autorisé : Vous n'avez pas la permission de gérer les paiements.");
    }

    // 🔒 L'élève doit appartenir à l'école de la personne connectée : sans cela, on pourrait
    // envoyer un message aux parents d'un élève d'une autre école.
    if (student_id) {
      const { data: student } = await adminClient.from('students').select('school_id').eq('id', student_id).maybeSingle();
      if (!student || student.school_id !== school_id) {
        throw new Error("Non autorisé : cet élève n'appartient pas à votre école.");
      }
    }
    // ==========================================

    // ============ PARTIE 1 : PUSH PERSONNEL ============
    let pushSent = 0;
    const { data: staff } = await adminClient
      .from('profiles')
      .select('id')
      .eq('school_id', school_id)
      .in('role', ['fondateur', 'directeur']);

    const userIds = (staff || []).map((s: { id: string }) => s.id);
    if (userIds.length > 0) {
      const { data: subs } = await adminClient.from('push_subscriptions').select('*').in('user_id', userIds);
      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: "💰 Nouveau paiement reçu !",
          body: `${student_name} a payé ${fmtAmount(amount)} F CFA (${type_frais}).`,
          url: "/argent"
        });
        for (const sub of subs) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
            pushSent++;
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      }
    }

    // ============ PARTIE 2 : WHATSAPP PARENTS ============
    let whatsappSent = 0;
    const whatsappErrors: string[] = [];

    if (student_id) {
      const dial = await getSchoolDial(adminClient, school_id); // indicatif ajouté aux numéros saisis sans « + »
      const { data: parentLinks } = await adminClient
        .from('parent_access_students')
        .select('parent_access ( id, full_name, phone, civilite, school_id )')
        .eq('student_id', student_id);

      // Parents de cette école seulement, avec un numéro valide, une seule fois par numéro.
      const seen = new Set<string>();
      const parents: { id: string; full_name: string; civilite: string | null; phone: string }[] = [];
      for (const l of (parentLinks || []) as any[]) {
        const p = l.parent_access;
        if (!p || p.school_id !== school_id) continue;
        const phone = normalizePhone(p.phone, dial);
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        parents.push({ id: p.id, full_name: p.full_name, civilite: p.civilite, phone });
      }

      if (parents.length > 0) {
        // Mêmes règles que les autres envois WhatsApp : pas de plan Découverte, pas d'école suspendue.
        const { data: school } = await adminClient
          .from('schools')
          .select('name, plan, statut')
          .eq('id', school_id)
          .single();
        const schoolName = school?.name || "L'école";
        const canSend = !!school && school.plan !== 'decouverte' && (school.statut === 'actif' || school.statut === 'essai');

        const { data: config } = await adminClient
          .from('openwa_configs')
          .select('base_url, session_id')
          .eq('school_id', school_id)
          .eq('statut', 'actif')
          .maybeSingle();

        const apiKey = Deno.env.get('OPENWA_API_KEY');

        if (!canSend) {
          whatsappErrors.push("Envoi WhatsApp indisponible pour cette école (plan ou compte)");
        } else if (config && apiKey) {
          const dateObj = date ? new Date(date) : new Date();
          const dateStr = (isNaN(dateObj.getTime()) ? new Date() : dateObj).toLocaleDateString('fr-FR');

          for (const parent of parents) {
            const civility = getCivility(parent.civilite);
            const greeting = civility
              ? `Bonjour ${civility} ${parent.full_name},`
              : `Bonjour ${parent.full_name},`;

            const messageText =
              `${greeting}\n\n` +
              `Nous confirmons avoir bien reçu votre paiement de *${fmtAmount(amount)} F CFA* ` +
              `pour *${student_name}* le ${dateStr}.\n\n` +
              `Type : ${type_frais}\n\n` +
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
              type: 'paiement',
              destinataire_phone: parent.phone,
              contenu: messageText,
              template_name: 'confirmation_paiement',
              statut,
              erreur,
            });
            if (historyError) console.error('[send-payment-push] historique non enregistré :', historyError.message);

            if (statut === 'envoye') whatsappSent++;
            else whatsappErrors.push(`${parent.full_name}: ${erreur}`);
          }
        } else {
          whatsappErrors.push("OpenWA non configuré pour cette école");
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      push_sent: pushSent,
      whatsapp_sent: whatsappSent,
      whatsapp_errors: whatsappErrors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('🔴 [send-payment-push] ERREUR:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
