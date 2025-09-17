import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();

    // Read request body once and destructure all needed fields
    const payload = await req.json();
    const {
      sessionId, action, pairingToken, deviceToken,
      callLogId, conversationId, conversationSummary, duration, outcome
    } = payload;

    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select(`
        *,
        relatives (
          id,
          first_name,
          last_name,
          household_id,
          device_token
        ),
        households (
          id,
          name
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Verify device access using pairing token or device token
    let hasAccess = false;

    if (pairingToken) {
      const { data: devicePair, error: pairError } = await supabase
        .from('device_pairs')
        .select('household_id, relative_id')
        .eq('pair_token', pairingToken)
        .eq('household_id', session.relatives.household_id)
        .single();

      if (!pairError && devicePair) {
        hasAccess = true;
      }
    }

    if (!hasAccess && deviceToken) {
      // Check if device token matches the relative's device
      if (session.relatives.device_token === deviceToken) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw new Error('Device not authorized for this call');
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const agentId = Deno.env.get('ELEVEN_AGENT_ID_IN_APP');

    if (!elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }
    if (!agentId) {
      throw new Error('ELEVEN_AGENT_ID_IN_APP not configured');
    }

    if (action === 'start') {
      console.log('Starting ElevenLabs WebRTC call for device session:', sessionId);

      // Get WebRTC conversation token (GET endpoint, no body)
      const tokenUrl = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`;

      const elevenLabsResponse = await fetch(tokenUrl, {
        method: 'GET',
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      });

      if (!elevenLabsResponse.ok) {
        const errorData = await elevenLabsResponse.text();
        console.error('ElevenLabs token API error:', errorData);
        throw new Error('Failed to get ElevenLabs WebRTC token');
      }

      const elevenLabsData = await elevenLabsResponse.json();
      const conversationToken = elevenLabsData.token;

      if (!conversationToken) {
        throw new Error('No conversation token received from ElevenLabs');
      }

      // Update session status
      await supabase
        .from('call_sessions')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Create call log entry (provider_call_id will be updated with conversationId from client)
      const { data: callLog, error: callLogError } = await supabase
        .from('call_logs')
        .insert({
          user_id: session.relatives.id, // Fix: Add user_id to prevent null constraint violation
          household_id: session.relatives.household_id,
          relative_id: session.relatives.id,
          call_outcome: 'in_progress',
          provider: 'elevenlabs',
          call_type: 'in_app_call',
          session_id: sessionId
        })
        .select()
        .single();

      if (callLogError) {
        console.error('Error creating call log:', callLogError);
      }

      console.log('ElevenLabs WebRTC call started successfully:', {
        sessionId,
        relativeId: session.relatives.id,
        householdId: session.relatives.household_id,
        callLogId: callLog?.id
      });

      return new Response(JSON.stringify({
        success: true,
        sessionId,
        conversationToken,
        agentId,
        relativeName: `${session.relatives.first_name} ${session.relatives.last_name}`,
        callLogId: callLog?.id,
        householdId: session.relatives.household_id,
        relativeId: session.relatives.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'update_conversation_id') {
      console.log('Updating call log with conversation ID');

      if (!callLogId || !conversationId) {
        throw new Error('callLogId and conversationId are required');
      }

      // Update both call log and session with conversation ID
      await Promise.all([
        supabase
          .from('call_logs')
          .update({ provider_call_id: conversationId })
          .eq('id', callLogId),
        supabase
          .from('call_sessions')
          .update({ provider_session_id: conversationId })
          .eq('id', sessionId)
      ]);

      console.log('Call log and session updated with conversation ID:', conversationId);

      return new Response(JSON.stringify({
        success: true,
        callLogId,
        conversationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'end') {
      console.log('Ending ElevenLabs WebRTC call for device session:', sessionId);

      // Update session status
      await supabase
        .from('call_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
          summary: conversationSummary
        })
        .eq('id', sessionId);

      // Update call log
      const { data: callLogs } = await supabase
        .from('call_logs')
        .select('id')
        .eq('session_id', sessionId)
        .eq('provider', 'elevenlabs');

      if (callLogs && callLogs.length > 0) {
        await supabase
          .from('call_logs')
          .update({
            call_outcome: outcome,
            call_duration: duration,
            conversation_summary: conversationSummary,
            timestamp: new Date().toISOString()
          })
          .eq('id', callLogs[0].id);

        // Create conversation summary for family dashboard
        if (conversationSummary) {
          await supabase
            .from('call_summaries')
            .insert({
              call_log_id: callLogs[0].id,
              household_id: session.relatives.household_id,
              relative_id: session.relatives.id,
              provider_call_id: session.provider_session_id,
              summary: conversationSummary,
              mood_assessment: 'positive', // Will be updated by AI analysis
              health_mentions: [],
              escalation_needed: false
            });
        }
      }

      console.log('ElevenLabs WebRTC call ended successfully:', {
        sessionId,
        duration,
        outcome
      });

      return new Response(JSON.stringify({
        success: true,
        sessionId,
        outcome,
        duration
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error('Invalid action. Use "start" or "end"');
    }

  } catch (error) {
    console.error('Error in elevenlabs-device-call function:', error);
    return new Response(JSON.stringify({
      error: 'operation_failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});