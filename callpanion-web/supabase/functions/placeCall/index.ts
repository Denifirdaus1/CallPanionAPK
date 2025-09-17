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
    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');

    if (!DAILY_API_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = serviceClient();
    
    // Get and validate JWT - extract caller's user ID
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
    const rateLimitKey = `placeCall:${ipAddress}`;
    const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      _identifier: rateLimitKey,
      _endpoint: 'placeCall',
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

    // Get request body
    const { customerId, familyMemberId } = await req.json();

    if (!customerId || !familyMemberId) {
      return new Response(JSON.stringify({ error: 'Missing customerId or familyMemberId' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Authorization check: familyMemberId must equal authenticated user ID
    if (familyMemberId !== user.id) {
      console.error('Unauthorized call placement attempt:', user.id, 'vs', familyMemberId);
      await supabase.rpc('log_security_event', {
        event_type_param: 'unauthorized_call_placement',
        details_param: { user_id: user.id, attempted_family_member_id: familyMemberId, customer_id: customerId }
      });
      return new Response(JSON.stringify({ error: 'Unauthorized: family member ID mismatch' }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this customer via household membership
    const { data: accessCheck, error: accessError } = await supabase.rpc('has_access_to_customer', {
      _uid: user.id,
      _customer_id: customerId
    });
    
    const { data: adminCheck, error: adminError } = await supabase.rpc('has_admin_access_with_mfa', {
      _uid: user.id
    });

    if (!accessCheck && !adminCheck) {
      console.error('Unauthorized access to customer:', user.id, customerId);
      await supabase.rpc('log_security_event', {
        event_type_param: 'unauthorized_customer_access',
        details_param: { user_id: user.id, customer_id: customerId }
      });
      return new Response(JSON.stringify({ error: 'Unauthorized access to customer' }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Create Daily.co room
    const roomResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          max_participants: 2,
          enable_chat: false,
          enable_screenshare: false,
          start_video_off: true,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
        },
      }),
    });

    if (!roomResponse.ok) {
      throw new Error('Failed to create Daily.co room');
    }

    const roomData = await roomResponse.json();

    // Store call record in database
    const { data: callData, error: callError } = await supabase
      .from('call_logs')
      .insert({
        user_id: customerId,
        call_outcome: 'initiated',
        provider: 'daily',
        call_type: 'family_call',
        session_id: roomData.name,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (callError) {
      console.error('Database error:', callError);
      throw new Error('Failed to store call record');
    }

    // Send notification to customer (you can implement push notifications here)
    console.log(`Call initiated for customer ${customerId} by family member ${user.id}`);

    return new Response(JSON.stringify({
      success: true,
      callId: callData.id,
      roomUrl: roomData.url,
      roomName: roomData.name,
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in placeCall function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});