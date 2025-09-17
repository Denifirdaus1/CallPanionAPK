import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  if (!origin) return false;
  const allowlist = getAllowedOrigins();
  try {
    const o = new URL(origin);
    return allowlist.includes(o.origin);
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  const allowed = isOriginAllowed(origin);
  const allowOrigin = allowed && origin ? origin : 'https://umjtepmdwfyfhdzbkyli.supabase.co';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface LeadSubmitRequest {
  email: string;
  name?: string;
  gdpr_marketing_consent: boolean;
  gdpr_consent_text: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  
  // Origin validation for enhanced security
  if (!isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({ error: 'Invalid origin' }),
      { status: 403, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validate origin and rate limit
    const origin = req.headers.get('origin') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';

    const { data: originValid } = await supabase.rpc('validate_origin_and_log', {
      _endpoint: 'leads-submit',
      _origin: origin,
      _ip_address: ipAddress,
      _user_agent: userAgent,
      _request_data: {}
    });

    if (!originValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid origin' }),
        { status: 403, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit by IP
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      _identifier: ipAddress,
      _endpoint: 'leads-submit',
      _max_requests: 5, // 5 submissions per minute per IP
      _window_minutes: 1
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Too many submissions. Please wait before trying again.' }),
        { status: 429, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    const requestData: LeadSubmitRequest = await req.json();
    const { email, name, gdpr_marketing_consent, gdpr_consent_text, utm_source, utm_medium, utm_campaign } = requestData;

    // Validate required fields
    if (!email || !gdpr_consent_text) {
      return new Response(
        JSON.stringify({ error: 'Email and consent text are required' }),
        { status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Create IP hash for privacy
    const encoder = new TextEncoder();
    const data = encoder.encode(ipAddress + 'callpanion_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Insert lead (will handle duplicates via unique constraint)
    const { data: lead, error: insertError } = await supabase
      .from('ops.leads')
      .insert({
        email,
        name: name || null,
        source: 'website',
        gdpr_marketing_consent,
        gdpr_consent_text,
        ip_hash: ipHash,
        user_agent: userAgent,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a duplicate email
      if (insertError.code === '23505') { // unique_violation
        return new Response(
          JSON.stringify({ error: 'Email already registered for waitlist' }),
          { status: 409, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Lead insertion error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to register for waitlist' }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead submitted successfully:', { email, name, consent: gdpr_marketing_consent });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Successfully registered for waitlist',
      lead_id: lead.id 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });

  } catch (error: any) {
    console.error('Error in leads-submit function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      }
    );
  }
};

serve(handler);