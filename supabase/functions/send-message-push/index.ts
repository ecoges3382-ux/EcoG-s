import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

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
    //    (L'app n'a jamais envoyé l'ancienne clé x-api-key pour le chat :
    //    avant, cette fonction refusait donc tous les appels de l'app.)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Non autorisé : connexion requise.' }, 401);

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: 'Non autorisé : session invalide ou expirée.' }, 401);
    }
    const callerId = userData.user.id;

    const { data: caller } = await adminClient
      .from('profiles')
      .select('school_id, full_name')
      .eq('id', callerId)
      .maybeSingle();
    if (!caller) return json({ error: 'Non autorisé : profil introuvable.' }, 401);

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) throw new Error("VAPID manquant.");
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const body = await req.json().catch(() => ({}));
    const { conversation_id, sender_name, message_content, sender_id } = body;
    if (!conversation_id || !sender_id) throw new Error("Paramètres manquants.");

    // 🔒 2. L'expéditeur annoncé doit être la personne connectée (pas d'usurpation).
    if (sender_id !== callerId) {
      return json({ error: "Interdit : tu ne peux envoyer que tes propres messages." }, 403);
    }

    const { data: conversation, error: convErr } = await adminClient
      .from('chat_conversations')
      .select('type, school_id')
      .eq('id', conversation_id)
      .single();
    if (convErr || !conversation) throw new Error("Conversation introuvable.");

    // 🔒 3. La conversation doit être celle de son école et, si elle est privée, il doit en faire partie.
    if (conversation.school_id !== caller.school_id) {
      return json({ error: "Interdit : cette conversation n'appartient pas à ton école." }, 403);
    }

    let userIds: string[] = [];
    if (conversation.type === 'general') {
      const { data: allUsers } = await adminClient.from('profiles').select('id').eq('school_id', conversation.school_id).neq('id', sender_id);
      userIds = (allUsers || []).map((u: any) => u.id);
    } else {
      const { data: participants } = await adminClient.from('chat_participants').select('user_id').eq('conversation_id', conversation_id);
      const all = (participants || []).map((p: any) => p.user_id);
      if (!all.includes(callerId)) {
        return json({ error: "Interdit : tu ne fais pas partie de cette conversation." }, 403);
      }
      userIds = all.filter((id: string) => id !== sender_id);
    }

    if (userIds.length === 0) return json({ ok: true, message: "Aucun destinataire." });

    const { data: subscriptions } = await adminClient.from('push_subscriptions').select('*').in('user_id', userIds);
    if (!subscriptions || subscriptions.length === 0) return json({ ok: true, message: "Pas d'abonnement push." });

    // Le nom affiché vient de la base (pas du client) : impossible de se faire passer pour un collègue.
    const displayName = caller.full_name || sender_name || 'Nouveau message';
    const text = String(message_content ?? '');
    const payload = JSON.stringify({
      title: `💬 ${displayName}`,
      body: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      url: "/chat"
    });

    const results = [];
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        results.push({ status: 'envoye' });
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        results.push({ status: 'echec', error: err.message });
      }
    }
    return json({ ok: true, results });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
