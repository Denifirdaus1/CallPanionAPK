import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};

// ← ganti setiap edit supaya mudah cek versi di logs
const REV = "check-email-exists@2025-09-12-03";

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return ok({ ok: false, reason: "method_not_allowed", rev: REV });

  try {
    const { email } = await req.json();
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!normalized) return ok({ ok: false, reason: "missing_email", rev: REV });

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error("[check-email-exists] missing secrets");
      return ok({ ok: false, reason: "missing_secrets", rev: REV });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    console.log(`[check-email-exists] rev=${REV} email=${normalized}`);

    // Tidak pakai getUserByEmail (tidak tersedia di v2).
    // Scan dengan listUsers (MVP-friendly).
    let page = 1;
    const perPage = 200;
    let found: any = null;

    while (page <= 50) { // safety cap
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("[check-email-exists] listUsers error:", error);
        return ok({ ok: false, reason: "admin_error", message: error.message, rev: REV });
      }
      const users = data?.users ?? [];
      found = users.find((u: any) => (u.email ?? "").toLowerCase() === normalized);
      if (found) break;
      if (users.length < perPage) break; // habis
      page++;
    }

    return ok({
      ok: true,
      rev: REV,
      exists: !!found,
      confirmed: !!found?.email_confirmed_at,
      user_id: found?.id ?? null,
    });
  } catch (e: any) {
    console.error("[check-email-exists] exception:", e);
    return ok({ ok: false, reason: "exception", message: String(e?.message ?? e), rev: REV });
  }
});