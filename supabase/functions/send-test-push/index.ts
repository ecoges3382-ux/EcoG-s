import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // x-api-key reste autorisé : l'app actuelle l'envoie encore, mais il n'est plus utilisé.
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

    // 1. Qui appelle ? On vérifie la session de la personne connectée.
    //    (L'ancienne clé x-api-key était visible dans le code public du site :
    //    elle ne protégeait rien, donc elle n'est plus utilisée.)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Non autorisé : connexion requise.' }, 401);

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: 'Non autorisé : session invalide ou expirée.' }, 401);
    }
    const callerId = userData.user.id;

    // 2. On n'envoie qu'à soi-même : un user_id d'une autre personne est refusé.
    const body = await req.json().catch(() => ({}));
    if (body?.user_id && body.user_id !== callerId) {
      return json({ error: 'Interdit : tu ne peux tester que tes propres notifications.' }, 403);
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      throw new Error('Configuration VAPID manquante.');
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 3. On cherche les abonnements de cette personne (un par appareil)
    const { data: subs, error: subError } = await adminClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', callerId);

    if (subError) throw new Error('Erreur base de données : ' + subError.message);
    if (!subs || subs.length === 0) {
      throw new Error("Aucun abonnement trouvé pour cet appareil. Veuillez d'abord activer le bouton.");
    }

    let pushSent = 0;

    // 4. On envoie la notification à chaque appareil
    for (const sub of subs) {
      const payload = JSON.stringify({
        title: '🔔 Test de notification',
        body: 'Si vous voyez ce message, les notifications fonctionnent parfaitement !',
        url: '/parametres',
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        pushSent++;
      } catch (err: any) {
        // Appareil qui n'existe plus : on nettoie sa ligne
        if (err.statusCode === 410 || err.statusCode === 404) {
          await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return json({ ok: true, push_sent: pushSent });
  } catch (err: any) {
    console.error('🔴 [send-test-push] ERREUR:', err.message);
    return json({ error: err.message }, 400);
  }
});
