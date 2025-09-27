// supabase/functions/elevenlabs-device-call/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeviceCallRequest {
  sessionId: string;
  action: 'start' | 'end' | 'update_conversation_id';
  pairingToken: string;
  deviceToken: string;
  conversationSummary?: string;
  duration?: number;
  outcome?: string;
  callLogId?: string;
  conversationId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const body: DeviceCallRequest = await req.json();

    console.log('=== elevenlabs-device-call triggered ===');
    console.log('Action:', body.action);
    console.log('SessionId:', body.sessionId);

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

    switch (body.action) {
      case 'start': {
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
            provider: 'webrtc',
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
            provider: 'webrtc',
            call_type: 'in_app_call',
            session_id: session.id,
            timestamp: new Date().toISOString()
          })
          .select()
          .single();

        if (logError) {
          console.error('Failed to create call log:', logError);
        }

        // Request conversation token from ElevenLabs
        console.log('Requesting conversation token from ElevenLabs...');
        console.log('Agent ID:', ELEVEN_AGENT_ID_IN_APP);
        
        const conversationResponse = await fetch('https://api.elevenlabs.io/v1/conversations/webrtc', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agent_id: ELEVEN_AGENT_ID_IN_APP,
            custom_voice_id: null, // Use agent's default voice
            custom_llm_extra_body: {
              // Pass context variables that the agent can use
              variables: {
                relative_name: relative.first_name || 'friend',
                relative_full_name: `${relative.first_name} ${relative.last_name}`,
                relative_location: `${relative.town}, ${relative.country}`,
                family_name: household?.family_name || 'your family',
                household_id: householdId,
                relative_id: relativeId,
                session_id: body.sessionId,
                call_type: 'in_app_call',
                device_call: 'true'
              }
            },
            // Post-call webhook configuration
            webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/elevenlabs-webhook`,
            webhook_secret: Deno.env.get('ELEVENLABS_WEBHOOK_SECRET'),
            // Additional metadata for webhook processing
            metadata: {
              household_id: householdId,
              relative_id: relativeId,
              session_id: body.sessionId,
              call_log_id: callLog?.id,
              call_type: 'in_app_call',
              device_initiated: 'true',
              relative_name: relative.first_name,
              family_name: household?.family_name,
              // Add timestamp for debugging
              created_at: new Date().toISOString()
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

        // Broadcast to dashboard that call is starting
        await supabase.from('realtime_events').insert({
          channel: `household:${householdId}`,
          event: 'call_started',
          payload: {
            session_id: session.id,
            relative_id: relativeId,
            relative_name: relative.first_name,
            call_type: 'in_app_call'
          }
        });

        return new Response(
          JSON.stringify({
            conversationToken: conversationData.conversation_token,
            conversationId: conversationData.conversation_id,
            callLogId: callLog?.id,
            householdId: householdId,
            relativeId: relativeId,
            relativeName: relative.first_name
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      case 'end': {
        // Update call session status
        const { error: sessionUpdateError } = await supabase
          .from('call_sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            duration: body.duration || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', body.sessionId);

        if (sessionUpdateError) {
          console.error('Failed to update call session:', sessionUpdateError);
        }

        // Update call log
        await supabase
          .from('call_logs')
          .update({
            call_outcome: body.outcome || 'completed',
            duration: body.duration,
            conversation_summary: body.conversationSummary,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', body.sessionId);

        // Broadcast to dashboard that call ended
        await supabase.from('realtime_events').insert({
          channel: `household:${householdId}`,
          event: 'call_ended',
          payload: {
            session_id: body.sessionId,
            relative_id: relativeId,
            duration: body.duration,
            outcome: body.outcome
          }
        });

        return new Response(
          JSON.stringify({ success: true }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      case 'update_conversation_id': {
        // Update call log with ElevenLabs conversation ID
        if (body.callLogId && body.conversationId) {
          await supabase
            .from('call_logs')
            .update({
              conversation_id: body.conversationId,
              updated_at: new Date().toISOString()
            })
            .eq('id', body.callLogId);

          console.log(`✅ Updated call log ${body.callLogId} with conversation ID ${body.conversationId}`);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${body.action}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error) {
    console.error('Error in elevenlabs-device-call:', error);
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