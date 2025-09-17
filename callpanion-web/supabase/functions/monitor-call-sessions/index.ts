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
    
    console.log("=== monitor-call-sessions triggered ===");
    
    // Get sessions that should have started but haven't been activated in 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data: missedSessions, error: selectError } = await supabase
      .from('call_sessions')
      .select(`
        id, scheduled_time, status, relative_id, household_id,
        relatives(first_name, last_name),
        households(name)
      `)
      .eq('status', 'scheduled')
      .lt('scheduled_time', fifteenMinutesAgo);

    if (selectError) {
      console.error('Error fetching missed sessions:', selectError);
      throw selectError;
    }

    console.log(`Found ${missedSessions?.length || 0} missed call sessions`);

    if (missedSessions && missedSessions.length > 0) {
      // Mark as missed and create alerts
      for (const session of missedSessions) {
        // Update session status
        await supabase
          .from('call_sessions')
          .update({ 
            status: 'missed',
            ended_at: new Date().toISOString()
          })
          .eq('id', session.id);

        // Log missed call
        await supabase
          .from('call_logs')
          .upsert({
            session_id: session.id,
            relative_id: session.relative_id,
            household_id: session.household_id,
            call_outcome: 'missed',
            call_type: 'in_app_call',
            timestamp: new Date().toISOString(),
            provider: 'webrtc'
          }, {
            onConflict: 'session_id'
          });

        // Create alert for household members
        const relativeName = session.relatives 
          ? `${session.relatives.first_name} ${session.relatives.last_name}`
          : 'Unknown';
        
        await supabase
          .from('alerts')
          .insert({
            household_id: session.household_id,
            type: 'missed_call',
            severity: 'MEDIUM',
            title: 'Missed Call',
            message: `Scheduled call with ${relativeName} was missed`,
            data: {
              session_id: session.id,
              relative_id: session.relative_id,
              scheduled_time: session.scheduled_time
            }
          });

        console.log(`Marked session ${session.id} as missed and created alert`);
      }
    }

    // Get active sessions that have been running too long (over 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: longRunningSessions, error: longRunningError } = await supabase
      .from('call_sessions')
      .select('id, started_at, relative_id, household_id')
      .eq('status', 'active')
      .lt('started_at', twoHoursAgo);

    if (longRunningError) {
      console.error('Error fetching long running sessions:', longRunningError);
    } else if (longRunningSessions && longRunningSessions.length > 0) {
      console.log(`Found ${longRunningSessions.length} long running sessions`);
      
      // Mark long running sessions as completed (assume they ended abnormally)
      for (const session of longRunningSessions) {
        await supabase
          .from('call_sessions')
          .update({ 
            status: 'completed',
            ended_at: new Date().toISOString(),
            duration_seconds: 7200 // 2 hours
          })
          .eq('id', session.id);

        // Log completion
        await supabase
          .from('call_logs')
          .upsert({
            session_id: session.id,
            relative_id: session.relative_id,
            household_id: session.household_id,
            call_outcome: 'completed',
            call_duration: 7200,
            call_type: 'in_app_call',
            timestamp: new Date().toISOString(),
            provider: 'webrtc'
          }, {
            onConflict: 'session_id'
          });

        console.log(`Marked long running session ${session.id} as completed`);
      }
    }

    // Update heartbeat
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'monitor-call-sessions',
        last_run: new Date().toISOString(),
        status: 'success',
        details: {
          missed_sessions: missedSessions?.length || 0,
          long_running_sessions: longRunningSessions?.length || 0,
          timestamp: new Date().toISOString()
        }
      }, {
        onConflict: 'job_name'
      });

    console.log(`=== monitor-call-sessions completed ===`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      missed_sessions: missedSessions?.length || 0,
      long_running_sessions: longRunningSessions?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in monitor-call-sessions:', error);
    
    // Update heartbeat with error
    const supabase = serviceClient();
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'monitor-call-sessions',
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