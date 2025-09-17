import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!elevenlabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('=== Polling Batch Call Status ===');

    // Get batch mappings that need status check (created in last 2 hours without provider_call_id)
    const { data: batchMappings, error: mappingsError } = await supabase
      .from('batch_call_mappings')
      .select(`
        id, batch_id, provider_call_id, phone_number, relative_id, household_id,
        scheduled_time_unix, created_at,
        relatives!inner(first_name, last_name),
        households!inner(name)
      `)
      .is('provider_call_id', null)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (mappingsError) {
      console.error('Error fetching batch mappings:', mappingsError);
      return new Response(JSON.stringify({ error: mappingsError.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`Found ${batchMappings?.length || 0} batch mappings to check`);

    let updatedCount = 0;
    let callsCreated = 0;

    for (const mapping of batchMappings || []) {
      try {
        console.log(`Checking batch ${mapping.batch_id} for ${mapping.phone_number}`);

        // Get batch calls from ElevenLabs
        const batchResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/batch-calling/get-calls?batch_id=${mapping.batch_id}`,
          {
            headers: {
              'xi-api-key': elevenlabsApiKey,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!batchResponse.ok) {
          console.error(`Failed to fetch batch calls for ${mapping.batch_id}:`, batchResponse.status);
          continue;
        }

        const batchData = await batchResponse.json();
        console.log(`Batch ${mapping.batch_id} has ${batchData.calls?.length || 0} calls`);

        // Find the call for this phone number
        const call = batchData.calls?.find((c: any) => 
          c.phone_number === mapping.phone_number || 
          c.phone_number === mapping.phone_number.replace(/^\+/, '')
        );

        if (call && call.conversation_id) {
          console.log(`Found call ${call.conversation_id} for ${mapping.phone_number}, status: ${call.status}`);

          // Update batch mapping with provider_call_id
          const { error: updateError } = await supabase
            .from('batch_call_mappings')
            .update({ 
              provider_call_id: call.conversation_id,
              resolved_at: new Date().toISOString()
            })
            .eq('id', mapping.id);

          if (updateError) {
            console.error('Error updating batch mapping:', updateError);
            continue;
          }

          updatedCount++;

          // Map status to our outcome
          let callOutcome = 'failed';
          if (call.status === 'completed' || call.status === 'done') {
            callOutcome = 'answered';
          } else if (call.status === 'busy') {
            callOutcome = 'busy';
          } else if (call.status === 'no-answer' || call.status === 'failed') {
            callOutcome = 'missed';
          }

          // Check if call log already exists
          const { data: existingLog } = await supabase
            .from('call_logs')
            .select('id')
            .eq('provider_call_id', call.conversation_id)
            .single();

          if (!existingLog) {
            // Create call log
            const { error: logError } = await supabase
              .from('call_logs')
              .insert({
                provider_call_id: call.conversation_id,
                provider: 'elevenlabs',
                call_outcome: callOutcome,
                call_duration: call.duration_seconds || null,
                user_id: mapping.relative_id,
                relative_id: mapping.relative_id,
                household_id: mapping.household_id,
                call_type: 'batch_call',
                timestamp: new Date().toISOString()
              });

            if (logError) {
              console.error('Error creating call log:', logError);
            } else {
              callsCreated++;
              console.log(`Created call log for ${call.conversation_id} with outcome: ${callOutcome}`);
            }
          }

          // Create call summary if the call was answered
          if (callOutcome === 'answered' && call.duration_seconds > 0) {
            const { data: existingSummary } = await supabase
              .from('call_summaries')
              .select('id')
              .eq('provider_call_id', call.conversation_id)
              .single();

            if (!existingSummary) {
              const { error: summaryError } = await supabase
                .from('call_summaries')
                .insert({
                  provider_call_id: call.conversation_id,
                  provider: 'elevenlabs',
                  relative_id: mapping.relative_id,
                  household_id: mapping.household_id,
                  mood: 'neutral',
                  tl_dr: 'Call completed - awaiting analysis'
                });

              if (summaryError) {
                console.error('Error creating call summary:', summaryError);
              }
            }
          }
        } else {
          console.log(`No call found for ${mapping.phone_number} in batch ${mapping.batch_id}`);
        }
      } catch (error) {
        console.error(`Error processing mapping ${mapping.id}:`, error);
      }
    }

    console.log(`=== Batch Status Polling Complete ===`);
    console.log(`Updated ${updatedCount} batch mappings`);
    console.log(`Created ${callsCreated} call logs`);

    return new Response(JSON.stringify({ 
      success: true,
      mappingsChecked: batchMappings?.length || 0,
      mappingsUpdated: updatedCount,
      callLogsCreated: callsCreated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in poll-batch-status:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});