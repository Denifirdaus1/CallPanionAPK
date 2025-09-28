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
    const body: ConversationTokenRequest = await req.json();

    console.log('=== elevenlabs-conversation-token triggered ===');
    console.log('SessionId:', body.sessionId);
    console.log('PairingToken:', body.pairingToken);

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

    // Request conversation token from ElevenLabs using the new API
    console.log('Requesting conversation token from ElevenLabs...');
    console.log('Agent ID:', ELEVEN_AGENT_ID_IN_APP);
    
    const conversationResponse = await fetch('https://api.elevenlabs.io/v1/convai/conversation/token', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: ELEVEN_AGENT_ID_IN_APP,
        source: 'callpanion_android',
        version: '1.0.0',
        // Additional context for the agent
        custom_llm_extra_body: {
          variables: {
            relative_name: relative.first_name || 'friend',
            relative_full_name: `${relative.first_name} ${relative.last_name}`,
            relative_location: `${relative.town}, ${relative.country}`,
            family_name: household?.family_name || 'your family',
            household_id: householdId,
            relative_id: relativeId,
            session_id: body.sessionId,
            call_type: 'in_app_call',
            device_call: 'true',
            ...body.dynamicVariables
          }
        }
      })
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

    // Update call log with conversation ID
    if (callLog?.id && conversationData.conversation_id) {
      await supabase
        .from('call_logs')
        .update({
          conversation_id: conversationData.conversation_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', callLog.id);
    }

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
        conversationId: conversationData.conversation_id,
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
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
