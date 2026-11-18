import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // x-api-key reste autorisé : l'app actuelle l'envoie encore, mais il n'est plus utilisé.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Mêmes rôles que ceux qui ont le droit de publier une annonce dans l'app (Announce.jsx).
const CAN_PUBLISH_ROLES = ['fondateur', 'directeur', 'secretaire'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

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
    if (!CAN_PUBLISH_ROLES.includes(caller.role)) {
      return json({ error: "Interdit : ton rôle ne permet pas d'envoyer des annonces." }, 403);
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) throw new Error("Secrets VAPID manquants.");
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const body = await req.json().catch(() => ({}));
    const { announcement_id } = body;
    if (!announcement_id) throw new Error("announcement_id manquant.");

    const { data: ann } = await adminClient.from('announcements').select('titre, contenu, audience, school_id').eq('id', announcement_id).single();
    if (!ann) throw new Error("Annonce introuvable.");

    // 🔒 2. L'annonce doit appartenir à l'école de la personne qui appelle.
    if (ann.school_id !== caller.school_id) {
      return json({ error: "Interdit : cette annonce n'appartient pas à ton école." }, 403);
    }

    let targetRoles: string[] = [];
    const audiences = ann.audience || [];
    if (audiences.includes('personnel') || audiences.includes('tout')) {
      targetRoles = ['fondateur', 'directeur', 'secretaire', 'enseignant', 'censeur'];
    } else {
      if (audiences.includes('enseignants')) targetRoles.push('enseignant');
      if (audiences.includes('equipe')) targetRoles.push('fondateur', 'directeur', 'secretaire', 'censeur');
    }
    if (targetRoles.length === 0) return json({ ok: true, message: "Aucune cible." });

    const { data: staff } = await adminClient.from('profiles').select('id').eq('school_id', ann.school_id).in('role', targetRoles);
    if (!staff || staff.length === 0) return json({ ok: true, message: "Aucun utilisateur." });

    const userIds = staff.map((s: any) => s.id);
    const { data: subscriptions } = await adminClient.from('push_subscriptions').select('*').in('user_id', userIds);
    if (!subscriptions || subscriptions.length === 0) return json({ ok: true, message: "Notifications non activées." });

    const payload = JSON.stringify({
      title: `📢 ${ann.titre}`,
      body: ann.contenu ? ann.contenu.substring(0, 100) : 'Nouvelle annonce publiée.',
      url: "/annonces"
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
