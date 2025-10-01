// supabase/functions/elevenlabs-conversation-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationTokenRequest {
  sessionId: string;
  pairingToken: string;
  deviceToken: string;
  householdId?: string;
  relativeId?: string;
  dynamicVariables?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    
    // Rate limiting and auth validation
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth validation failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ConversationTokenRequest = await req.json();

    console.log('=== elevenlabs-conversation-token triggered ===');
    console.log('SessionId:', body.sessionId);
    console.log('PairingToken:', body.pairingToken ? '[REDACTED]' : 'none');

    // Validate device pairing
    const { data: devicePair, error: pairError } = await supabase
      .from('device_pairs')
      .select('household_id, relative_id, device_info')
      .eq('pairing_token', body.pairingToken)
      .not('claimed_at', 'is', null)
      .single();

    if (pairError || !devicePair) {
      console.error('Invalid pairing token:', pairError);
      return new Response(
        JSON.stringify({ error: 'Invalid pairing token or device not paired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const householdId = devicePair.household_id;
    const relativeId = devicePair.relative_id;

    // Check for concurrent calls limit (ElevenLabs plan limits)
    const { data: activeCalls, error: activeCallsError } = await supabase
      .from('call_sessions')
      .select('id')
      .eq('household_id', householdId)
      .eq('status', 'active')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

    if (activeCallsError) {
      console.warn('Failed to check active calls:', activeCallsError);
    } else if (activeCalls && activeCalls.length >= 3) { // Max 3 concurrent calls per household
      console.warn(`Too many concurrent calls for household ${householdId}: ${activeCalls.length}`);
      return new Response(
        JSON.stringify({ 
          error: 'Too many concurrent calls. Please wait before starting another call.',
          code: 'CONCURRENT_CALL_LIMIT'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ElevenLabs API key and Agent ID
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const ELEVEN_AGENT_ID_IN_APP = Deno.env.get('ELEVEN_AGENT_ID_IN_APP');

    if (!ELEVENLABS_API_KEY || !ELEVEN_AGENT_ID_IN_APP) {
      throw new Error('Missing ElevenLabs configuration');
    }

    // Get relative information for context
    const { data: relative, error: relativeError } = await supabase
      .from('relatives')
      .select('first_name, last_name, town, country')
      .eq('id', relativeId)
      .single();

    if (relativeError) {
      throw new Error(`Failed to fetch relative info: ${relativeError.message}`);
    }

    // Get household information
    const { data: household } = await supabase
      .from('households')
      .select('family_name, primary_user_id')
      .eq('id', householdId)
      .single();

    // Create conversation session in database
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .insert({
        id: body.sessionId,
        household_id: householdId,
        relative_id: relativeId,
        status: 'connecting',
        provider: 'elevenlabs',
        call_type: 'in_app_call',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create call session: ${sessionError.message}`);
    }

    // Create initial call log
    const { data: callLog, error: logError } = await supabase
      .from('call_logs')
      .insert({
        user_id: relativeId,
        relative_id: relativeId,
        household_id: householdId,
        call_outcome: 'initiating',
        provider: 'elevenlabs',
        call_type: 'in_app_call',
        session_id: session.id,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create call log:', logError);
    }

    // Request conversation token from ElevenLabs using the correct API
    console.log('Requesting conversation token from ElevenLabs...');
    console.log('Agent ID:', ELEVEN_AGENT_ID_IN_APP);
    
    const conversationResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${ELEVEN_AGENT_ID_IN_APP}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!conversationResponse.ok) {
      const errorText = await conversationResponse.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`Failed to get conversation token: ${conversationResponse.status}`);
    }

    const conversationData = await conversationResponse.json();
    
    console.log('✅ Conversation token received');

    // Update session status to active
    await supabase
      .from('call_sessions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    // Note: conversation_id will be updated later by client after onConnect()

    // Broadcast to dashboard that call is starting
    await supabase.from('realtime_events').insert({
      channel: `household:${householdId}`,
      event: 'call_started',
      payload: {
        session_id: session.id,
        relative_id: relativeId,
        relative_name: relative.first_name,
        call_type: 'in_app_call',
        provider: 'elevenlabs'
      }
    });

    return new Response(
      JSON.stringify({
        conversationToken: conversationData.token,
        conversationId: null, // will be updated by client after onConnect()
        callLogId: callLog?.id,
        householdId: householdId,
        relativeId: relativeId,
        relativeName: relative.first_name,
        sessionId: session.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in elevenlabs-conversation-token:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});