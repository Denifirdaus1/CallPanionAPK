import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

// Fixed deployment issue - 2025-01-14

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  // Allow null origin for mobile app requests
  if (!origin) return true;
  
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

interface PairClaimRequest {
  code: string;
  pairToken: string;
  device_fingerprint?: string;
}

interface PairClaimResponse {
  session: any;
  device_id: string;
  household_id: string;
  device_email: string;
  // Removed temp_password from response for security
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
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

    // Skip origin validation for mobile app requests (they don't have origin header)
    const originHeader = req.headers.get('origin');
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';

    // Only validate origin if it's present (web requests), allow mobile requests without origin
    if (originHeader) {
      const { data: originValid } = await supabase.rpc('validate_origin_and_log', {
        _endpoint: 'pair-claim',
        _origin: originHeader,
        _ip_address: ipAddress,
        _user_agent: userAgent,
        _request_data: {}
      });

      if (!originValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid origin' }),
          { status: 403, headers: { ...corsHeaders(originHeader), 'Content-Type': 'application/json' } }
        );
      }
    }

    // Rate limiting disabled for development
    // const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
    //   _identifier: ipAddress,
    //   _endpoint: 'pair-claim',
    //   _max_requests: 50,
    //   _window_minutes: 5
    // });

    // if (!rateLimitOk) {
    //   return new Response(
    //     JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }),
    //     { status: 429, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
    //   );
    // }

    const { user_id, pairing_code }: { user_id: string; pairing_code: string } = await req.json();

    if (!user_id || !pairing_code) {
      return new Response(
        JSON.stringify({ error: 'user_id and pairing_code are required' }),
        { status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Find and validate pairing token
    const { data: pairingTokens, error: findError } = await supabase
      .from('device_pairs')
      .select('*')
      .eq('code_6', pairing_code)
      .gt('expires_at', new Date().toISOString())
      .is('claimed_at', null)
      .limit(1);

    if (findError || !pairingTokens || pairingTokens.length === 0) {
      console.error('Invalid pairing token:', findError);
      
      return new Response(
        JSON.stringify({ error: 'Invalid or expired pairing code' }),
        { status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    const pairingToken = pairingTokens[0];

    // Get relative name for response
    const { data: relative } = await supabase
      .from('relatives')
      .select('first_name, last_name')
      .eq('id', pairingToken.relative_id)
      .single();

    // Skip customer_id and devices table - use device_pairs directly for notifications
    console.log('Using simplified device pairing without customer_id/device_id dependencies');

    // Mark pairing token as claimed and store device info
    const { error: updateError } = await supabase
      .from('device_pairs')
      .update({
        claimed_by: user_id,
        claimed_at: new Date().toISOString(),
        device_info: {
          claimed_by_user_id: user_id,
          claim_timestamp: new Date().toISOString(),
          claim_ip: req.headers.get('x-forwarded-for') || 'unknown',
          platform: 'android',
          paired_at: new Date().toISOString()
        }
      })
      .eq('id', pairingToken.id);

    if (updateError) {
      console.error('Token update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to claim pairing code' }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    console.log('Device paired successfully:', { 
      user_id, 
      household_id: pairingToken.household_id,
      relative_id: pairingToken.relative_id
    });

    return new Response(JSON.stringify({
      success: true,
      pairing_token: pairingToken.pair_token,
      household_id: pairingToken.household_id,
      relative_id: pairingToken.relative_id,
      relative_name: relative ? `${relative.first_name} ${relative.last_name}` : 'Your Family'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });

  } catch (error: any) {
    console.error('Error in pair-claim function:', error);
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