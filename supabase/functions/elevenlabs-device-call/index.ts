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
      .eq('pair_token', body.pairingToken)
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

        // Clean up old sessions for this relative (but not the current one)
        const now = new Date().toISOString();
        
        // Step 1: Expire other active sessions for this relative
        const { data: oldActiveSessions } = await supabase
          .from('call_sessions')
          .select('id, status')
          .eq('relative_id', relativeId)
          .neq('id', body.sessionId)
          .in('status', ['connecting', 'ringing', 'active', 'scheduled']);
        
        if (oldActiveSessions && oldActiveSessions.length > 0) {
          console.log(`🧹 Expiring ${oldActiveSessions.length} old active sessions for relative ${relativeId}`);
          await supabase
            .from('call_sessions')
            .update({ 
              status: 'expired', 
              ended_at: now,
              updated_at: now 
            })
            .in('id', oldActiveSessions.map(s => s.id));
        }
        
        // Step 3: UPSERT session - if it exists (from scheduler), update it; otherwise create new
        console.log(`✨ Upserting session: ${body.sessionId}`);
        const { data: session, error: sessionError } = await supabase
          .from('call_sessions')
          .upsert({
            id: body.sessionId,
            household_id: householdId,
            relative_id: relativeId,
            status: 'connecting',
            provider: 'webrtc',
            call_type: 'in_app_call',
            scheduled_time: now,
            started_at: now,
            updated_at: now
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (sessionError) {
          throw new Error(`Failed to upsert call session: ${sessionError.message}`);
        }

        // Upsert call log (may already exist from scheduler)
        const { data: callLog, error: logError } = await supabase
          .from('call_logs')
          .upsert({
            user_id: relativeId,
            relative_id: relativeId,
            household_id: householdId,
            call_outcome: 'answered',
            provider: 'webrtc',
            call_type: 'in_app_call',
            session_id: session.id,
            provider_call_id: session.id,
            timestamp: new Date().toISOString()
          }, {
            onConflict: 'provider,provider_call_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (logError) {
          console.error('Failed to upsert call log:', logError);
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
            conversationToken: conversationData.token,
            conversationId: null, // will be updated by client after onConnect()
            callLogId: callLog?.id,
            householdId: householdId,
            relativeId: relativeId,
            relativeName: relative.first_name,
            sessionId: session.id,  // Added for compatibility with elevenlabs-conversation-token
            providerCallId: session.id  // 👈 Add provider_call_id for webhook
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      case 'end': {
        // Update call session status - use duration_seconds not duration
        const { error: sessionUpdateError } = await supabase
          .from('call_sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            duration_seconds: body.duration || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', body.sessionId);

        if (sessionUpdateError) {
          console.error('Failed to update call session:', sessionUpdateError);
        }

        // Update call log - use call_duration not duration
        await supabase
          .from('call_logs')
          .update({
            call_outcome: body.outcome || 'completed',
            call_duration: body.duration,
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
              provider_call_id: body.conversationId, // 👈 Update provider_call_id with conversation_id
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
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});