import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabase = serviceClient();
    
    // Get device info from request
    const { deviceToken, pairingToken } = await req.json();

    if (!deviceToken && !pairingToken) {
      throw new Error('Either deviceToken or pairingToken is required');
    }

    let relativeId: string | null = null;
    let householdId: string | null = null;

    // If pairingToken provided, get device info from pairing system
    if (pairingToken) {
      const { data: pairData, error: pairError } = await supabase
        .from('device_pairs')
        .select('relative_id, household_id, claimed_at')
        .eq('pair_token', pairingToken)
        .single();

      if (pairError || !pairData || !pairData.claimed_at) {
        throw new Error('Invalid or unclaimed pairing token');
      }

      relativeId = pairData.relative_id;
      householdId = pairData.household_id;
    }

    // If deviceToken provided, get info from device registration
    if (deviceToken && !relativeId) {
      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select('customer_id, household_id')
        .eq('push_token', deviceToken)
        .single();

      if (!deviceError && deviceData) {
        householdId = deviceData.household_id;
        // For devices table, we might need to map customer_id to relative_id
        // This depends on your data structure
      }
    }

    if (!householdId) {
      return new Response(JSON.stringify({
        success: true,
        scheduledCalls: [],
        message: 'No household found for device'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for scheduled in-app calls in the next 5 minutes (±5 min window)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const nextFiveMinutes = new Date(now.getTime() + 5 * 60 * 1000);

    // Get pending call sessions for this household/relative
    const { data: scheduledCalls, error: callsError } = await supabase
      .from('call_sessions')
      .select(`
        id,
        household_id,
        relative_id,
        scheduled_time,
        status,
        call_type,
        relatives(first_name, last_name)
      `)
      .eq('household_id', householdId)
      .eq('call_type', 'in_app_call')
      .eq('status', 'scheduled')
      .gte('scheduled_time', fiveMinutesAgo.toISOString())
      .lte('scheduled_time', nextFiveMinutes.toISOString());

    if (callsError) {
      console.error('Error fetching scheduled calls:', callsError);
      throw new Error('Failed to fetch scheduled calls');
    }

    // Filter by relative if we have specific relative ID
    const filteredCalls = relativeId 
      ? scheduledCalls?.filter(call => call.relative_id === relativeId) || []
      : scheduledCalls || [];

    // Also check for any active sessions that might need attention
    const { data: activeCalls, error: activeError } = await supabase
      .from('call_sessions')
      .select(`
        id,
        household_id,
        relative_id,
        scheduled_time,
        started_at,
        status,
        call_type,
        relatives(first_name, last_name)
      `)
      .eq('household_id', householdId)
      .eq('call_type', 'in_app_call')
      .in('status', ['active', 'ringing']);

    if (!activeError && activeCalls) {
      filteredCalls.push(...activeCalls);
    }

    // Update device last_seen if we have the info
    if (deviceToken) {
      EdgeRuntime.waitUntil(
        supabase
          .from('devices')
          .update({ last_sync: new Date().toISOString() })
          .eq('push_token', deviceToken)
      );
    }

    console.log('Scheduled calls check:', {
      householdId,
      relativeId,
      foundCalls: filteredCalls.length,
      timeWindow: `${now.toISOString()} to ${nextFiveMinutes.toISOString()}`
    });

    return new Response(JSON.stringify({
      success: true,
      scheduledCalls: filteredCalls.map(call => ({
        sessionId: call.id,
        relativeId: call.relative_id,
        householdId: call.household_id,
        scheduledTime: call.scheduled_time,
        startedAt: call.started_at,
        status: call.status,
        relativeName: call.relatives ? `${call.relatives.first_name} ${call.relatives.last_name}` : 'Unknown'
      })),
      currentTime: now.toISOString(),
      checkWindow: nextFiveMinutes.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-scheduled-calls function:', error);
    return new Response(JSON.stringify({ 
      error: 'check_failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});