import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COOLDOWN_SECONDS = 60; // adjust if needed

const CORS = {
  "Access-Control-Allow-Origin": "*", // set to your app origin if you prefer
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Check for Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ message: "Authorization required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const body = await req.json().catch(() => ({}));
    const inviteId = body?.inviteId?.toString().trim();
    const email = body?.email?.toString().trim();
    
    // Need either inviteId (resend flow) or email (original flow)
    if (!inviteId && !email) {
      return new Response(JSON.stringify({ message: "InviteId or email required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let emailForLimiting = email;

    // If this is a resend flow (inviteId provided), get the email from the invite
    if (inviteId) {
      const { data: invite, error: inviteErr } = await sb
        .from("invites")
        .select("email")
        .eq("id", inviteId)
        .single();

      if (inviteErr || !invite?.email) {
        return new Response(JSON.stringify({ message: "Invalid invite" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      
      emailForLimiting = invite.email;
    }

    // Check limiter using the email (either from body or from invite lookup)
    const { data: row, error: selErr } = await sb
      .from("invite_rate_limiter")
      .select("last_sent_at")
      .eq("email", emailForLimiting)
      .maybeSingle();

    if (selErr) {
      console.error("Limiter select error", selErr);
    }

    if (row) {
      const elapsed = (Date.now() - new Date(row.last_sent_at).getTime()) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        const retry = Math.ceil(COOLDOWN_SECONDS - elapsed);
        return new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retry),
            ...CORS,
          },
        });
      }
    }

    // Forward to your original sender using the user's JWT (not service role)
    const forwardUrl = `${SUPABASE_URL}/functions/v1/send-invite-email`;
    const fRes = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the user's Authorization header so send-invite-email can validate permissions
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    const text = await fRes.text(); // pass through the exact body
    if (!fRes.ok) {
      // Bubble up original status & body with CORS
      return new Response(text || JSON.stringify({ message: "Upstream error" }), {
        status: fRes.status,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Record send time on success using the email we determined earlier
    const ip = req.headers.get("x-forwarded-for") || undefined;
    const { error: upErr } = await sb.from("invite_rate_limiter").upsert({
      email: emailForLimiting,
      last_sent_at: new Date().toISOString(),
      last_ip: ip,
    });
    if (upErr) console.error("Limiter upsert error", upErr);

    return new Response(text || JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.error("Unhandled error", e);
    return new Response(JSON.stringify({ message: "Unexpected error", error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});