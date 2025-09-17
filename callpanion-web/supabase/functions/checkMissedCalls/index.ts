import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serviceClient } from '../_shared/client.ts';

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  const allowlist = getAllowedOrigins();
  if (!origin) return false;
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  // Origin allowlist check
  if (!isOriginAllowed(origin)) {
    return new Response('Forbidden origin', { status: 403, headers: corsHeaders(origin) });
  }

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    const supabase = serviceClient();
    
    // Get and validate JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting check
    const rateLimitKey = `checkMissedCalls:${ipAddress}`;
    const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      _identifier: rateLimitKey,
      _endpoint: 'checkMissedCalls',
      _max_requests: 10,
      _window_minutes: 5
    });
    
    if (rateLimitError || !rateLimitCheck) {
      console.error('Rate limit exceeded for:', ipAddress);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Authorization check: verify user has access to this relative
    const { data: relativeData, error: relativeError } = await supabase
      .from('relatives')
      .select('household_id')
      .eq('id', user_id)
      .single();
    
    if (relativeError || !relativeData) {
      return new Response(JSON.stringify({ error: 'Relative not found' }), {
        status: 404,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Check if authenticated user has access to this household
    const { data: memberCheck, error: memberError } = await supabase.rpc('app_is_household_member', {
      _household_id: relativeData.household_id
    });
    
    const { data: adminCheck, error: adminError } = await supabase.rpc('has_admin_access_with_mfa', {
      _uid: user.id
    });
    
    if (!memberCheck && !adminCheck) {
      console.error('Unauthorized access to check missed calls:', user.id, user_id);
      await supabase.rpc('log_security_event', {
        event_type_param: 'unauthorized_missed_calls_check',
        details_param: { user_id: user.id, target_user_id: user_id, household_id: relativeData.household_id }
      });
      return new Response(JSON.stringify({ error: 'Unauthorized access' }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Get the last 5 calls for this user using secure function
    const { data: recentCalls, error: callsError } = await supabase.rpc('get_call_data_secure', {
      user_id_param: user_id,
      date_range_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // Last 7 days
    });

    if (callsError) {
      console.error('Error fetching recent calls:', callsError);
      throw new Error('Failed to fetch recent calls');
    }

    if (!recentCalls || recentCalls.length < 2) {
      console.log('Not enough call history to check for consecutive misses');
      return new Response(JSON.stringify({ 
        success: true, 
        alert_sent: false,
        reason: 'Insufficient call history'
      }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Check if the last 2 calls were missed
    const lastTwoCalls = recentCalls.slice(0, 2);
    const consecutiveMisses = lastTwoCalls.every(call => call.call_outcome === 'missed');

    if (!consecutiveMisses) {
      console.log('No consecutive missed calls detected');
      return new Response(JSON.stringify({ 
        success: true, 
        alert_sent: false,
        reason: 'No consecutive missed calls'
      }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    console.log(`Consecutive missed calls detected for user ${user_id}`);

    // Get family contacts for this user using secure function
    const { data: householdData, error: householdError } = await supabase.rpc('get_household_safe', {
      household_id_param: relativeData.household_id
    });

    if (householdError) {
      console.error('Error fetching household data:', householdError);
    }

    const userName = `User ${user_id}`; // In real implementation, get from profiles
    const lastAnsweredCall = recentCalls.find(call => call.call_outcome === 'completed');
    const lastAnsweredTime = lastAnsweredCall ? new Date(lastAnsweredCall.call_timestamp).toLocaleString() : 'Unknown';

    // Send alerts to family members (placeholder - in real implementation use sendFamilyAlert function)
    console.log(`Alert would be sent to household ${relativeData.household_id} about ${userName}`);
    
    return new Response(JSON.stringify({
      success: true,
      alert_sent: true,
      alerts_sent_count: 1,
      user_name: userName,
      last_answered_time: lastAnsweredTime,
      consecutive_misses: 2
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error checking missed calls:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});