import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serviceClient } from '../_shared/client.ts';
import { isValidUUID } from '../_shared/util.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

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
    // Get user session for authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize user client for auth verification
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { ai_call_id, minutes } = await req.json();

    if (!ai_call_id || typeof minutes !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing ai_call_id or minutes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isValidUUID(ai_call_id)) {
      return new Response(JSON.stringify({ error: 'Invalid ai_call_id format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (minutes < 1 || minutes > 480) { // Max 8 hours
      return new Response(JSON.stringify({ error: 'Minutes must be between 1 and 480' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = serviceClient();

    // Get the call details to verify authorization and current status
    const { data: call, error: callError } = await supabase
      .from('app.ai_calls')
      .select('customer_id, status, scheduled_for')
      .eq('id', ai_call_id)
      .single();

    if (callError || !call) {
      return new Response(JSON.stringify({ error: 'Call not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if call can be snoozed (must be scheduled or ringing)
    if (!['scheduled', 'ringing'].includes(call.status)) {
      return new Response(JSON.stringify({ 
        error: `Cannot snooze call with status: ${call.status}. Call must be scheduled or ringing.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is authorized (must be the customer or a household member)
    const { data: authorization, error: authCheckError } = await supabase
      .from('app.household_members')
      .select('household_id')
      .eq('customer_id', call.customer_id)
      .eq('user_id', user.id)
      .single();

    // Also check if user is the customer directly
    const isCustomer = call.customer_id === user.id;
    const isHouseholdMember = authorization && !authCheckError;

    if (!isCustomer && !isHouseholdMember) {
      return new Response(JSON.stringify({ error: 'Unauthorized to snooze this call' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate new scheduled time
    const currentScheduledFor = new Date(call.scheduled_for);
    const newScheduledFor = new Date(currentScheduledFor.getTime() + minutes * 60 * 1000);
    
    // Make sure we're not scheduling in the past
    const now = new Date();
    if (newScheduledFor <= now) {
      // If the calculated time is in the past, schedule for now + minutes
      newScheduledFor.setTime(now.getTime() + minutes * 60 * 1000);
    }

    // Update the call with new scheduled time and snoozed status
    const { data: updatedCall, error: updateError } = await supabase
      .from('app.ai_calls')
      .update({
        status: 'snoozed',
        scheduled_for: newScheduledFor.toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...call.metadata,
          snooze_history: [
            ...(call.metadata?.snooze_history || []),
            {
              snoozed_at: new Date().toISOString(),
              snoozed_by: user.id,
              minutes_added: minutes,
              previous_scheduled_for: call.scheduled_for,
            }
          ]
        }
      })
      .eq('id', ai_call_id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error snoozing call:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to snooze call' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Call ${ai_call_id} snoozed for ${minutes} minutes. New time: ${newScheduledFor.toISOString()}`);

    return new Response(JSON.stringify({
      success: true,
      call: updatedCall,
      new_scheduled_for: newScheduledFor.toISOString(),
      minutes_added: minutes,
      snoozed_by: user.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in snoozeCall:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});