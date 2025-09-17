import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { relativeId, householdId } = await req.json();

    if (!relativeId || !householdId) {
      throw new Error('relativeId and householdId are required');
    }

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('role')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      throw new Error('Unauthorized access to household');
    }

    // Verify relative exists in this household
    const { data: relative, error: relativeError } = await supabase
      .from('relatives')
      .select('*')
      .eq('id', relativeId)
      .eq('household_id', householdId)
      .single();

    if (relativeError || !relative) {
      throw new Error('Relative not found');
    }

    // Create call session record
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .insert({
        household_id: householdId,
        relative_id: relativeId,
        status: 'scheduled',
        provider: 'webrtc',
        call_type: 'in_app_call',
        scheduled_time: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Failed to create call session:', sessionError);
      throw new Error('Failed to create call session');
    }

    // Get ElevenLabs API key and agent ID for in-app calls
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const agentId = Deno.env.get('ELEVEN_AGENT_ID_IN_APP');
    
    if (!elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }
    if (!agentId) {
      throw new Error('ELEVEN_AGENT_ID_IN_APP not configured');
    }

    // Create ElevenLabs conversation session with dynamic variables for tracking
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url');
    url.searchParams.append('agent_id', agentId);
    
    // Add session ID to conversation for webhook tracking
    const dynamicVariables = {
      session_id: session.id,
      secret__household_id: householdId,
      secret__relative_id: relativeId,
      call_type: 'in_app_call'
    };
    
    const elevenLabsResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dynamic_variables: dynamicVariables
      })
    });

    if (!elevenLabsResponse.ok) {
      const errorData = await elevenLabsResponse.text();
      console.error('ElevenLabs API error:', errorData);
      throw new Error('Failed to create ElevenLabs conversation session');
    }

    const elevenLabsData = await elevenLabsResponse.json();
    const signedUrl = elevenLabsData.signed_url;

    if (!signedUrl) {
      throw new Error('No signed URL received from ElevenLabs');
    }

    // Create pairing token for device connection
    const pairingToken = `in_app_${user.id}_${Date.now()}`;
    
    const { error: tokenError } = await supabase
      .from('pairing_tokens')
      .insert({
        token: pairingToken,
        session_id: session.id,
        user_id: user.id,
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
      });

    if (tokenError) {
      console.error('Failed to create pairing token:', tokenError);
      throw new Error('Failed to create pairing token');
    }

    console.log('Voice session started successfully:', {
      sessionId: session.id,
      relativeId,
      householdId,
      userId: user.id
    });

    return new Response(JSON.stringify({
      ok: true,
      sessionId: session.id,
      agentId: agentId,
      signedUrl: signedUrl,
      pairingToken: pairingToken,
      relativeName: `${relative.first_name} ${relative.last_name}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in voice-start function:', error);
    return new Response(JSON.stringify({ 
      error: 'start_failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});