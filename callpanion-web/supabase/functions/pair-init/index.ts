import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient, getElderAppBaseUrl } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PairInitRequest {
  household_id: string;
  device_label?: string;
}

interface PairInitResponse {
  pairToken: string;
  code: string;
  expiresAt: string;
  qrPayload: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate origin and rate limit
    const origin = req.headers.get('origin') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';

    const { data: originValid } = await supabase.rpc('validate_origin_and_log', {
      _endpoint: 'pair-init',
      _origin: origin,
      _ip_address: ipAddress,
      _user_agent: userAgent,
      _request_data: {}
    });

    if (!originValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid origin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check - increased limits for pairing
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      _identifier: user.id,
      _endpoint: 'pair-init',
      _max_requests: 20, // 20 pairing attempts per 5 minutes
      _window_minutes: 5
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { relative_id }: { relative_id: string } = await req.json();

    if (!relative_id) {
      return new Response(
        JSON.stringify({ error: 'relative_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get relative and verify user is household admin
    const { data: relative, error: relativeError } = await supabase
      .from('relatives')
      .select('household_id')
      .eq('id', relative_id)
      .single();

    if (relativeError || !relative) {
      return new Response(
        JSON.stringify({ error: 'Relative not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin of this household
    const { data: isAdmin } = await supabase.rpc('app_is_household_admin', {
      _household_id: relative.household_id
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Must be household admin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Generate secure pair token
    const pairToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create pairing token record
    const { error: insertError } = await supabase
      .from('device_pairs')
      .insert({
        household_id: relative.household_id,
        relative_id: relative_id,
        code_6: code,
        pair_token: pairToken,
        expires_at: expiresAt.toISOString(),
        created_by: user.id
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create pairing session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pairing initiated successfully:', { relative_id, code, user_id: user.id });

    return new Response(JSON.stringify({
      success: true,
      pairing_code: code,
      expires_at: expiresAt.toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in pair-init function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);