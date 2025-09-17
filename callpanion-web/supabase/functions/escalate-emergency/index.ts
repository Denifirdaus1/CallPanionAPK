import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from "../_shared/client.ts";

// Secure CORS configuration
function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const allowlist = getAllowedOrigins();
  const isAllowed = origin && allowlist.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowlist[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  try {
    // Extract and validate authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const { household_id, relative_id, emergency_type, details, severity = 'high' } = await req.json();

    console.log('Emergency escalation request:', { emergency_type, severity });

    if (!household_id || !relative_id || !emergency_type) {
      throw new Error('household_id, relative_id, and emergency_type are required');
    }

    const supabase = serviceClient();
    
    // Get user from token for authorization
    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed');
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this household via the relative
    const { data: householdCheck, error: householdError } = await supabase.rpc(
      'validate_household_access',
      { _user_id: user.id, _household_id: household_id }
    );

    if (householdError || !householdCheck) {
      console.error('Unauthorized household access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized access' }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Create high-priority emergency notification
    const { data: notification, error: notificationError } = await supabase
      .from('family_notifications')
      .insert({
        household_id,
        relative_id,
        title: `🚨 Emergency Alert: ${emergency_type}`,
        message: details || 'Emergency situation detected. Please check on your relative immediately.',
        priority: 'emergency',
        notification_type: 'emergency_escalation'
      })
      .select()
      .single();

    if (notificationError) {
      console.error('Error creating emergency notification:', notificationError);
      throw notificationError;
    }

    // Log the emergency in call sessions if there's an active session
    const { data: activeSession } = await supabase
      .from('ai_call_sessions')
      .select('id')
      .eq('relative_id', relative_id)
      .eq('session_status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (activeSession) {
      await supabase
        .from('ai_call_sessions')
        .update({
          emergency_detected: true,
          conversation_summary: `Emergency detected: ${emergency_type}. ${details || ''}`
        })
        .eq('id', activeSession.id);
    }

    console.log('Emergency escalated successfully');

    return new Response(JSON.stringify({
      success: true,
      notification_id: notification.id,
      message: 'Emergency escalated successfully',
      emergency_type,
      severity
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in escalate-emergency:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: 'Emergency escalation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
  }
});