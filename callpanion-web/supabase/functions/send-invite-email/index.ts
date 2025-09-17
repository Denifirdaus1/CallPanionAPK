import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw) return null
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function isOriginAllowed(origin: string | null) {
  const allowlist = getAllowedOrigins()
  if (!allowlist) return true
  if (!origin) return false
  try {
    const o = new URL(origin)
    return allowlist.includes(o.origin)
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null) {
  const allowed = isOriginAllowed(origin)
  const allowOrigin = allowed && origin ? origin : 'https://umjtepmdwfyfhdzbkyli.supabase.co'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

interface InviteEmailRequest {
  email: string;
  token: string;
  household_id: string;
  household_name?: string;
  inviter_name?: string;
}

interface ResendInviteRequest {
  inviteId: string;
}

// Email template functions - duplicated here since we can't import from src/
type InviteVars = {
  token: string;
  householdId?: string;
  inviteeEmail: string;
  inviterName?: string;
};

function inviteSubject(vars: InviteVars) {
  const name = vars.inviterName?.trim() || 'A family member';
  return `${name} invited you to join CallPanion`;
}

function invitePreheader(vars: InviteVars) {
  return `Accept the invite to view and support your loved one on CallPanion.`;
}

function inviteJoinUrl(vars: InviteVars) {
  const base = 'https://callpanion.co.uk/accept-invite';
  const q = new URLSearchParams({ token: vars.token });
  if (vars.householdId) q.set('household_id', vars.householdId);
  return `${base}?${q.toString()}`;
}

function inviteHtml(vars: InviteVars) {
  const joinUrl = inviteJoinUrl(vars);
  const preheader = invitePreheader(vars);
  const inviter = vars.inviterName?.trim() || 'A family member';

  return `
<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${inviteSubject(vars)}</title>
  <style>
    /* Basic reset for email clients */
    body,table,td,a{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}
    img{border:0;outline:none;text-decoration:none;max-width:100%;}
    table{border-collapse:collapse;}
    .btn a{display:inline-block;padding:14px 22px;text-decoration:none;border-radius:6px;}
    .muted{color:#6b7280;font-size:12px;line-height:1.5;}
    .container{width:100%;background:#F7F7F5;padding:24px 0;}
    .card{max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;}
    .header{padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#0F3B2E;color:#ffffff;}
    .h1{margin:0;font-size:20px;line-height:1.3;font-weight:700;}
    .content{padding:24px;}
    .cta{margin:24px 0;}
    .btn a{background:#C75B3B;color:#ffffff;font-weight:700;}
    .secondary a{color:#C75B3B;word-break:break-all;}
    .footer{padding:16px 24px;text-align:center;}
    @media (prefers-color-scheme: dark){
      .container{background:#0b0f0d;}
      .card{background:#111827;border-color:#1f2937;}
      .header{background:#0F3B2E;color:#fff;}
      .btn a{background:#C75B3B;color:#fff;}
      .muted{color:#9CA3AF;}
    }
  </style>
</head>
<body style="margin:0;padding:0;">
  <div class="container">
    <table role="presentation" class="card" aria-label="CallPanion invitation email">
      <tr>
        <td class="header">
          <div class="h1">CallPanion</div>
          <div style="font-size:0;height:0;opacity:0;overflow:hidden;display:none;">${preheader}</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p style="margin:0 0 12px 0;">Hello,</p>
          <p style="margin:0 0 12px 0;">${inviter} has invited you to join their <strong>CallPanion</strong> household so you can privately view wellbeing updates and support a loved one.</p>
          <div class="cta btn"><a href="${joinUrl}" target="_blank" rel="noopener">Accept invite</a></div>
          <p class="secondary" style="margin:0 0 8px 0;">Or paste this link into your browser:<br><a href="${joinUrl}" target="_blank" rel="noopener">${joinUrl}</a></p>
          <p style="margin:16px 0 0 0;">If you weren't expecting this, you can safely ignore the email and no changes will be made.</p>
        </td>
      </tr>
      <tr><td class="footer">
        <p class="muted">
          You're receiving this because ${vars.inviteeEmail} was entered as a contact for a CallPanion household invite.<br>
          We process emails for service delivery under UK GDPR &amp; PECR. Questions? Contact support@callpanion.co.uk.
        </p>
        <p class="muted">© ${new Date().getFullYear()} CallPanion. All rights reserved.</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
}

function inviteText(vars: InviteVars) {
  const inviter = vars.inviterName?.trim() || 'A family member';
  const joinUrl = inviteJoinUrl(vars);
  return [
    `${inviter} has invited you to join their CallPanion household.`,
    ``,
    `Accept your invite: ${joinUrl}`,
    ``,
    `If you weren't expecting this, you can ignore the email.`,
    ``,
    `You received this because ${vars.inviteeEmail} was entered for a CallPanion invite.`
  ].join('\n');
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin')

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  // Origin allowlist check
  if (!isOriginAllowed(origin)) {
    return new Response('Forbidden origin', { status: 403, headers: corsHeaders(origin) })
  }

  // Require authentication
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) })
  }

  try {
    // Verify user authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    
    const { data: userData, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !userData.user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) })
    }

    const requestBody = await req.json();
    
    // Handle resend by inviteId
    if ('inviteId' in requestBody) {
      const { inviteId }: ResendInviteRequest = requestBody;
      
      if (!inviteId) {
        return new Response(
          JSON.stringify({ error: "Missing inviteId" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
        );
      }

      // Create service client to read invite token securely
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!supabaseServiceKey) {
        throw new Error('Service role key missing')
      }
      
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey)
      
      // Get invite details using service client
      const { data: inviteData, error: inviteError } = await supabaseService
        .from('invites')
        .select('id, email, token, household_id, accepted_at, expires_at, metadata')
        .eq('id', inviteId)
        .single();

      if (inviteError || !inviteData) {
        return new Response(
          JSON.stringify({ error: "Invite not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
        );
      }

      // Check if invite is still valid
      if (inviteData.accepted_at) {
        return new Response(
          JSON.stringify({ error: "Invite already accepted" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
        );
      }

      if (new Date(inviteData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Invite expired" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
        );
      }

      // Check authorization using user client
      const { data: isAuthorized } = await supabaseUser.rpc('app_is_household_admin', {
        _household_id: inviteData.household_id
      });

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Must be household admin to resend invites" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
        );
      }

      // Per-invite cooldown (2 minutes)
      const lastSentAtStr = inviteData.metadata?.last_sent_at as string | undefined;
      if (lastSentAtStr) {
        const lastSentAt = new Date(lastSentAtStr).getTime();
        const now = Date.now();
        const cooldownMs = 2 * 60 * 1000; // 2 minutes
        const remainingMs = lastSentAt + cooldownMs - now;
        if (remainingMs > 0) {
          const retrySeconds = Math.ceil(remainingMs / 1000);
          return new Response(
            JSON.stringify({ error: `Please wait ${retrySeconds} seconds before resending this invite` }),
            { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retrySeconds), ...corsHeaders(origin) } }
          );
        }
      }

      // Check rate limit using user client (higher threshold for resends)
      const { data: rateLimitOk } = await supabaseUser.rpc('check_rate_limit', {
        _identifier: userData.user.id,
        _endpoint: 'send-invite-email',
        _max_requests: 20,
        _window_minutes: 60
      });

      if (!rateLimitOk) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded for sending invites' }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
        );
      }

      // Send the email using existing template
      const templateVars: InviteVars = {
        token: inviteData.token,
        householdId: inviteData.household_id,
        inviteeEmail: inviteData.email,
        inviterName: userData.user.user_metadata?.display_name || "a family member"
      };

      const emailResponse = await resend.emails.send({
        from: "CallPanion <invites@callpanion.co.uk>",
        to: [inviteData.email],
        subject: inviteSubject(templateVars),
        html: inviteHtml(templateVars),
        text: inviteText(templateVars),
      });

      // Update last_sent_at in invite metadata (best-effort)
      try {
        const newMetadata = { ...(inviteData.metadata || {}), last_sent_at: new Date().toISOString() };
        await supabaseService
          .from('invites')
          .update({ metadata: newMetadata })
          .eq('id', inviteData.id);
      } catch (e) {
        console.log('Failed to update invite metadata last_sent_at:', e);
      }

      console.log("Resent invite email successfully:", emailResponse);

      return new Response(JSON.stringify({ 
        success: true, 
        email_id: emailResponse.data?.id 
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(origin),
        },
      });
    }

    // Handle original send invitation flow
    const { 
      email, 
      token, 
      household_id, 
      household_name = "your household",
      inviter_name = "a family member" 
    }: InviteEmailRequest = requestBody;

    if (!email || !token || !household_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, token, household_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    // SECURITY FIX: Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    // SECURITY FIX: Rate limit email sending
    const { data: rateLimitOk } = await supabaseUser.rpc('check_rate_limit', {
      _identifier: userData.user.id,
      _endpoint: 'send-invite-email',
      _max_requests: 5,
      _window_minutes: 60
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded for sending invites' }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    // SECURITY FIX: Verify user can send invites for this household
    const { data: isAuthorized } = await supabaseUser.rpc('app_is_household_admin', {
      _household_id: household_id
    });

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Must be household admin to send invites" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    // SECURITY FIX: Validate the invite token exists and belongs to this household
    const { data: inviteData, error: inviteError } = await supabaseUser
      .from('invites')
      .select('id, household_id, email')
      .eq('token', token)
      .eq('household_id', household_id)
      .eq('email', email)
      .single();

    if (inviteError || !inviteData) {
      return new Response(
        JSON.stringify({ error: "Invalid invite token or unauthorized invite" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    // SECURITY FIX: Sanitize input values to prevent XSS in email templates
    const sanitizeString = (str: string) => str.replace(/[<>&"']/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return entities[char] || char;
    });

    // Prepare template variables with sanitized inputs
    const templateVars: InviteVars = {
      token: token, // Token is safe, generated server-side
      householdId: household_id, // UUID is safe
      inviteeEmail: email, // Already validated with regex
      inviterName: sanitizeString(inviter_name?.substring(0, 100) || "a family member")
    };

    const emailResponse = await resend.emails.send({
      from: "CallPanion <invites@callpanion.co.uk>",
      to: [email],
      subject: inviteSubject(templateVars),
      html: inviteHtml(templateVars),
      text: inviteText(templateVars),
    });

    console.log("Invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      email_id: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin),
      },
    });
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  }
};

serve(handler);