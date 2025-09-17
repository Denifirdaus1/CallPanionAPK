import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

// Fixed deployment issue - 2025-01-14

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

    const { sessionId, outcome, error_detail, duration_seconds, summary, conversationId } = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    // Get the call session first to verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select(`
        *,
        household_members!inner(user_id)
      `)
      .eq('id', sessionId)
      .eq('household_members.user_id', user.id)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found or unauthorized');
    }

    // Update the call session
    const { error: updateError } = await supabase
      .from('call_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: duration_seconds || null
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update call session:', updateError);
      throw new Error('Failed to update call session');
    }

    // Create call log record with proper validation and context
    const { data: callLog, error: logError } = await supabase
      .from('call_logs')
      .insert({
        household_id: session.household_id,
        relative_id: session.relative_id,
        user_id: session.relative_id, // For backward compatibility
        provider: 'webrtc',
        call_type: 'in_app_call',
        call_outcome: outcome || 'completed',
        call_duration: duration_seconds || null,
        conversation_summary: summary || null,
        session_id: sessionId,
        provider_call_id: conversationId || null
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create call log:', logError);
      // Don't throw error here, session end should still succeed
    }

    // Create call summary for dashboard viewing
    if (callLog && !logError) {
      const { error: summaryError } = await supabase
        .from('call_summaries')
        .insert({
          household_id: session.household_id,
          relative_id: session.relative_id,
          call_log_id: callLog.id,
          provider: 'webrtc',
          mood: 'unknown', // Will be updated by analysis if available
          tl_dr: summary || 'In-app call completed'
        });

      if (summaryError) {
        console.error('Failed to create call summary:', summaryError);
      }
    }

    // Invalidate any remaining pairing tokens for this session
    const { error: tokenError } = await supabase
      .from('pairing_tokens')
      .update({ used: true })
      .eq('session_id', sessionId);

    if (tokenError) {
      console.error('Failed to invalidate pairing tokens:', tokenError);
      // Don't throw error here
    }

    console.log('Voice session ended successfully:', {
      sessionId,
      outcome: outcome || 'completed',
      duration: duration_seconds,
      userId: user.id
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in voice-end function:', error);
    return new Response(JSON.stringify({ 
      error: 'end_failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});