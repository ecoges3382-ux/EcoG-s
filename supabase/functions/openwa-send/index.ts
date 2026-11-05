// supabase/functions/openwa-send/index.ts
//
// Envoie un ou plusieurs messages WhatsApp via un serveur OpenWA auto-hébergé
// (open-wa / wa-automate-nodejs, endpoint POST /sendText).
//
// Auth :
//   - soit un JWT utilisateur (Authorization: Bearer <user_jwt>)  -> isolé à son école
//   - soit la SERVICE_ROLE_KEY (pour appels internes / cron)
//
// Payload accepté :
//   { "schoolId": "uuid", "messages": [ { "to": "229XXXXXXXX", "text": "..." }, ... ] }
// ou  { "schoolId": "uuid", "to": "229XXXXXXXX", "text": "..." }
//
// Secrets à définir :
//   supabase secrets set OPENWA_URL="https://wa.example.com" OPENWA_API_KEY="xxxxx"

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENWA_URL = Deno.env.get("OPENWA_URL") || "";
const OPENWA_API_KEY = Deno.env.get("OPENWA_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type OutMsg = { to: string; ok: boolean; status?: number; messageId?: string; error?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** 229XXXXXXXX -> 229XXXXXXXX@c.us (format open-wa) */
function toChatId(phone: string): string {
  const digits = String(phone).replace(/\D/g, "");
  return `${digits}@c.us`;
}

/** Nettoie et valide un numéro international. Retourne null si invalide. */
function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ---- Config serveur
  if (!OPENWA_URL || !OPENWA_API_KEY) {
    return json(
      {
        error: "openwa_not_configured",
        detail: "Définir les secrets OPENWA_URL et OPENWA_API_KEY (supabase secrets set ...)",
      },
      500,
    );
  }

  // ---- Auth
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing_auth" }, 401);

  const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
  let callerId: string | null = null;

  const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (!isServiceRole) {
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data, error } = await supabaseUser.auth.getUser();
    if (error || !data?.user) return json({ error: "invalid_token" }, 401);
    callerId = data.user.id;
  }

  // ---- Payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const rawItems: Array<{ to: unknown; text: unknown }> = Array.isArray(body?.messages)
    ? body.messages
    : body?.to && body?.text
      ? [body]
      : [];

  if (rawItems.length === 0) return json({ error: "empty_payload" }, 400);
  if (rawItems.length > 200) return json({ error: "too_many_messages", max: 200 }, 400);

  const schoolId: string | null = body?.schoolId ? String(body.schoolId) : null;

  // ---- Isolation multi-école : un utilisateur non-service ne peut envoyer
  //      que pour son école, et seulement s'il a un rôle autorisé.
  if (!isServiceRole) {
    if (!schoolId) return json({ error: "school_required" }, 400);

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", callerId)
      .maybeSingle();

    if (pErr) return json({ error: "profile_lookup_failed", detail: pErr.message }, 500);
    if (!profile) return json({ error: "profile_not_found" }, 403);
    if (profile.school_id !== schoolId) return json({ error: "forbidden_school" }, 403);

    const allowed = ["fondateur", "directeur", "secretaire"];
    if (profile.role && !allowed.includes(profile.role)) {
      return json({ error: "forbidden_role", role: profile.role }, 403);
    }
  }

  // ---- Envoi
  const results: OutMsg[] = [];

  for (const item of rawItems) {
    const phone = normalizePhone(item.to);
    const text = String(item.text ?? "").trim();

    if (!phone) {
      results.push({ to: String(item.to ?? ""), ok: false, error: "invalid_phone" });
      continue;
    }
    if (!text) {
      results.push({ to: phone, ok: false, error: "empty_text" });
      continue;
    }
    if (text.length > 4096) {
      results.push({ to: phone, ok: false, error: "text_too_long", status: 400 });
      continue;
    }

    try {
      const resp = await fetch(`${OPENWA_URL.replace(/\/+$/, "")}/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_key: OPENWA_API_KEY,
        },
        body: JSON.stringify({
          to: toChatId(phone),
          content: text,
        }),
      });

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        /* réponse non-JSON : ignore */
      }

      const ok = resp.ok;
      const messageId = data?.id || data?.messageId || data?.message?.id || null;
      const errMsg = ok ? undefined : data?.error || data?.message || `http_${resp.status}`;

      results.push({
        to: phone,
        ok,
        status: resp.status,
        messageId: messageId || undefined,
        error: errMsg,
      });

      // Historique (facultatif — voir section 4)
      if (schoolId) {
        await supabaseAdmin
          .from("whatsapp_messages")
          .insert({
            school_id: schoolId,
            to_phone: phone,
            body: text,
            status: ok ? "sent" : "failed",
            provider: "openwa",
            provider_message_id: messageId,
            error: ok ? null : errMsg,
            sent_by: callerId,
          })
          .then(({ error }) => {
            if (error) console.warn("whatsapp_messages insert failed:", error.message);
          });
      }
    } catch (e) {
      results.push({
        to: phone,
        ok: false,
        error: (e as Error)?.message || "network_error",
      });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return json({
    ok: sent === results.length,
    sent,
    failed: results.length - sent,
    results,
  });
});
