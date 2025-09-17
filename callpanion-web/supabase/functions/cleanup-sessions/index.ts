import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    
    console.log("=== cleanup-sessions triggered ===");
    
    // Cleanup expired sessions (older than 24 hours and not completed)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: expiredSessions, error: selectError } = await supabase
      .from('call_sessions')
      .select('id, status, scheduled_time')
      .neq('status', 'completed')
      .lt('scheduled_time', twentyFourHoursAgo);

    if (selectError) {
      console.error('Error fetching expired sessions:', selectError);
      throw selectError;
    }

    console.log(`Found ${expiredSessions?.length || 0} expired sessions to cleanup`);

    if (expiredSessions && expiredSessions.length > 0) {
      // Mark expired sessions as failed
      const { error: updateError } = await supabase
        .from('call_sessions')
        .update({ 
          status: 'failed',
          ended_at: new Date().toISOString()
        })
        .in('id', expiredSessions.map(s => s.id));

      if (updateError) {
        console.error('Error updating expired sessions:', updateError);
        throw updateError;
      }

      // Log failed calls
      for (const session of expiredSessions) {
        await supabase
          .from('call_logs')
          .upsert({
            session_id: session.id,
            call_outcome: 'expired',
            call_type: 'in_app_call',
            timestamp: new Date().toISOString(),
            provider: 'webrtc'
          }, {
            onConflict: 'session_id'
          });
      }
    }

    // Cleanup expired pairing tokens (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { error: tokenCleanupError } = await supabase
      .from('pairing_tokens')
      .delete()
      .lt('expires_at', oneHourAgo);

    if (tokenCleanupError) {
      console.error('Error cleaning up pairing tokens:', tokenCleanupError);
      // Don't throw, continue with other cleanup
    }

    // Update heartbeat
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'cleanup-sessions',
        last_run: new Date().toISOString(),
        status: 'success',
        details: {
          expired_sessions_cleaned: expiredSessions?.length || 0,
          timestamp: new Date().toISOString()
        }
      }, {
        onConflict: 'job_name'
      });

    console.log(`=== cleanup-sessions completed: cleaned ${expiredSessions?.length || 0} sessions ===`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      cleaned_sessions: expiredSessions?.length || 0 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in cleanup-sessions:', error);
    
    // Update heartbeat with error
    const supabase = serviceClient();
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'cleanup-sessions',
        last_run: new Date().toISOString(),
        status: 'error',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }, {
        onConflict: 'job_name'
      });

    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});