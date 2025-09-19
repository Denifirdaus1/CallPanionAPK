import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();

    // Get and validate JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get call session from database and verify user access
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select(`
        *,
        relatives(first_name, last_name),
        household_members!inner(user_id, role)
      `)
      .eq('id', sessionId)
      .eq('household_members.user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error('Session not found or unauthorized:', sessionError);
      return new Response(JSON.stringify({ error: 'Session not found or unauthorized' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate WebRTC connection details for in-app calls
    // For now, return a simple room identifier that the frontend can use
    const roomId = `call_${sessionId}_${Date.now()}`;

    // Update session with room details
    const { error: updateError } = await supabase
      .from('call_sessions')
      .update({
        room_id: roomId,
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update session:', updateError);
      throw new Error('Failed to update session');
    }

    console.log('RTC token generated successfully:', {
      sessionId,
      roomId,
      userId: user.id,
      relativeName: session.relatives ? `${session.relatives.first_name} ${session.relatives.last_name}` : 'Unknown'
    });

    return new Response(JSON.stringify({
      success: true,
      roomId: roomId,
      sessionId: sessionId,
      relativeName: session.relatives ? `${session.relatives.first_name} ${session.relatives.last_name}` : 'Unknown',
      agentId: Deno.env.get('ELEVEN_AGENT_ID_IN_APP'),
      userRole: session.household_members?.role || 'FAMILY_MEMBER'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in getRtcToken function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});