import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
    console.log('=== schedulerDailyCalls (Batch Calls Only) triggered ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);

    const supabase = serviceClient();

    // Get environment variables for ElevenLabs
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const ELEVEN_AGENT_ID = Deno.env.get('ELEVEN_AGENT_ID');
    const ELEVEN_PHONE_ID = Deno.env.get('ELEVEN_PHONE_NUMBER_ID');

    if (!ELEVENLABS_API_KEY || !ELEVEN_AGENT_ID) {
      throw new Error('Missing required environment variables for batch calls');
    }

    console.log('Environment check passed, fetching due schedules for batch calls...');

    // Get due schedules using the existing RPC function
    const { data: dueSchedules, error: scheduleError } = await supabase
      .rpc('rpc_find_due_schedules_next_min');

    if (scheduleError) {
      console.error('Error fetching due schedules:', scheduleError);
      throw scheduleError;
    }

    console.log(`Found ${dueSchedules?.length || 0} total due schedules:`, dueSchedules);

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log('No due schedules found for batch calls');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No due schedules found for batch calls',
        dispatched: 0,
        failed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group schedules by household to check call method preference
    const householdSchedules = new Map();
    for (const schedule of dueSchedules) {
      if (!householdSchedules.has(schedule.household_id)) {
        householdSchedules.set(schedule.household_id, []);
      }
      householdSchedules.get(schedule.household_id).push(schedule);
    }

    // Get household preferences - only get households with batch_call preference
    const householdIds = Array.from(householdSchedules.keys());
    const { data: households, error: householdError } = await supabase
      .from('households')
      .select('id, call_method_preference')
      .in('id', householdIds)
      .eq('call_method_preference', 'batch_call'); // Only batch call households

    if (householdError) {
      console.error('Error fetching household preferences:', householdError);
      throw householdError;
    }

    let batchCallSchedules = [];

    // Get schedules only for batch call households
    for (const household of households || []) {
      const schedules = householdSchedules.get(household.id) || [];
      // Only process if phone number exists for batch calls
      batchCallSchedules.push(...schedules.filter(s => s.phone_number && s.phone_number.trim() !== ''));
    }

    console.log(`Batch call schedules to process: ${batchCallSchedules.length}`);

    let successfulDispatches = 0;
    let failedDispatches = 0;

    // Process batch calls (ElevenLabs only)
    if (batchCallSchedules.length > 0 && ELEVEN_PHONE_ID) {
      // Group by run_at_unix for batch processing
      const batchGroups = new Map();
      for (const schedule of batchCallSchedules) {
        const key = schedule.run_at_unix;
        if (!batchGroups.has(key)) {
          batchGroups.set(key, []);
        }
        batchGroups.get(key).push(schedule);
      }

      // Process each batch group
      for (const [scheduledTime, schedules] of batchGroups.entries()) {
        try {
          console.log(`Processing batch group for time ${scheduledTime} with ${schedules.length} calls`);

          const recipients = schedules.map((schedule, index) => ({
            phone_number: schedule.phone_number,
            user_name: `Relative ${schedule.relative_id.slice(0, 8)}`
          }));

          // Submit batch call to ElevenLabs with correct payload format
          const batchResponse = await fetch('https://api.elevenlabs.io/v1/convai/batch-calling/submit', {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              call_name: `Batch Call ${new Date(scheduledTime * 1000).toISOString().slice(0, 16)}`,
              agent_id: ELEVEN_AGENT_ID,
              agent_phone_number_id: ELEVEN_PHONE_ID,
              scheduled_time_unix: scheduledTime,
              recipients: recipients
            }),
          });

          const responseData = await batchResponse.json();
          console.log('ElevenLabs batch response:', responseData);

          if (batchResponse.ok && responseData.id) {
            // Store batch mapping for secure resolution in webhook
            for (const schedule of schedules) {
              await supabase
                .from('batch_call_mappings')
                .insert({
                  batch_id: responseData.id,
                  batch_name: `Batch Call ${new Date(scheduledTime * 1000).toISOString().slice(0, 16)}`,
                  household_id: schedule.household_id,
                  relative_id: schedule.relative_id,
                  phone_number: schedule.phone_number,
                  scheduled_time_unix: scheduledTime
                });
            }

            // Record call logs for each schedule in the batch
            for (const schedule of schedules) {
              await supabase
                .from('call_logs')
                .insert({
                  user_id: schedule.relative_id,
                  relative_id: schedule.relative_id,
                  household_id: schedule.household_id,
                  call_outcome: 'scheduled',
                  provider: 'elevenlabs',
                  provider_call_id: responseData.id,
                  call_type: 'batch_call',
                  timestamp: new Date(schedule.run_at_unix * 1000).toISOString()
                });

              // Update daily tracking
              await supabase
                .from('daily_call_tracking')
                .upsert({
                  relative_id: schedule.relative_id,
                  household_id: schedule.household_id,
                  call_date: new Date().toISOString().split('T')[0],
                  [`${schedule.slot_type}_called`]: true
                }, {
                  onConflict: 'relative_id,household_id,call_date'
                });
            }

            successfulDispatches += schedules.length;
            console.log(`Successfully dispatched ${schedules.length} batch calls`);
          } else {
            console.error('Failed to submit batch call:', responseData);
            failedDispatches += schedules.length;
          }
        } catch (error) {
          console.error('Error processing batch group:', error);
          failedDispatches += schedules.length;
        }
      }
    }

    // Update heartbeat for batch calls only
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'callpanion-batch-calls',
        last_run: new Date().toISOString(),
        status: 'success',
        details: {
          batch_calls_dispatched: successfulDispatches,
          batch_calls_failed: failedDispatches,
          total_due_schedules: dueSchedules.length,
          batch_schedules: batchCallSchedules.length
        }
      }, {
        onConflict: 'job_name'
      });

    console.log('=== schedulerDailyCalls (Batch Calls Only) completed ===');
    console.log(`Successful batch dispatches: ${successfulDispatches}`);
    console.log(`Failed batch dispatches: ${failedDispatches}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Batch call scheduling completed',
      dispatched: successfulDispatches,
      failed: failedDispatches,
      batch_calls: batchCallSchedules.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in schedulerDailyCalls (batch calls):', error);
    
    // Log error to heartbeat
    const supabase = serviceClient();
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'callpanion-batch-calls',
        last_run: new Date().toISOString(),
        status: 'error',
        details: {
          error: error.message,
          stack: error.stack
        }
      }, {
        onConflict: 'job_name'
      });

    return new Response(JSON.stringify({ 
      error: 'batch_call_scheduling_failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});