import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Récupération des variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      throw new Error("Configuration VAPID manquante sur le serveur.");
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 2. Vérification de la sécurité (Token de l'utilisateur)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Non autorisé : Token manquant.");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) throw new Error("Non autorisé : Token invalide.");

    // 3. Récupération des données envoyées par l'application
    const body = await req.json();
    const { school_id, title, message, url } = body;

    if (!school_id || !title || !message) throw new Error("Paramètres manquants.");

    // 4. Vérifier que l'utilisateur appartient bien à cette école
    const { data: profile } = await adminClient
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.school_id !== school_id) {
      throw new Error("Non autorisé : Vous n'appartenez pas à cette école.");
    }

    // 5. Récupérer les abonnements Push des Fondateurs et Directeurs
    const { data: staff } = await adminClient
      .from('profiles')
      .select('id')
      .eq('school_id', school_id)
      .in('role', ['fondateur', 'directeur']);

    const userIds = (staff || []).map(s => s.id);
    let pushSent = 0;

    if (userIds.length > 0) {
      const { data: subs } = await adminClient
        .from('push_subscriptions')
        .select('*')
        .in('user_id', userIds);

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: title,
          body: message,
          url: url || "/"
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);
            pushSent++;
          } catch (err: any) {
            // Si l'abonnement a expiré (téléphone changé, app désinstallée), on le supprime
            if (err.statusCode === 410 || err.statusCode === 404) {
              await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, push_sent: pushSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('🔴 [send-admin-push] ERREUR:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
