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
    const { relative_id, household_id } = await req.json();

    const supabase = serviceClient();

    console.log(`=== DEBUG FCM TOKENS ===`);
    console.log(`Relative ID: ${relative_id}`);
    console.log(`Household ID: ${household_id}`);

    // 1. Check device_pairs
    const { data: devicePairs, error: deviceError } = await supabase
      .from('device_pairs')
      .select('*')
      .eq('household_id', household_id)
      .eq('relative_id', relative_id);

    console.log(`Device pairs:`, { devicePairs, deviceError });

    if (devicePairs && devicePairs.length > 0) {
      devicePairs.forEach((pair, index) => {
        console.log(`Device pair ${index + 1}:`, {
          id: pair.id,
          claimed_by: pair.claimed_by,
          claimed_at: pair.claimed_at,
          device_info: pair.device_info,
          expires_at: pair.expires_at
        });
      });
    }

    // 2. Check push_notification_tokens for all household members
    const { data: householdMembers, error: memberError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', household_id);

    console.log(`Household members:`, { householdMembers, memberError });

    if (householdMembers && householdMembers.length > 0) {
      for (const member of householdMembers) {
        const { data: tokens, error: tokenError } = await supabase
          .from('push_notification_tokens')
          .select('*')
          .eq('user_id', member.user_id);

        console.log(`Tokens for user ${member.user_id}:`, { tokens, tokenError });
      }
    }

    // 3. Check if there are any claimed device pairs for this household
    const { data: allPairs, error: allPairsError } = await supabase
      .from('device_pairs')
      .select('*')
      .eq('household_id', household_id)
      .not('claimed_at', 'is', null);

    console.log(`All claimed device pairs for household:`, { allPairs, allPairsError });

    // 4. Get relatives info
    const { data: relatives, error: relativeError } = await supabase
      .from('relatives')
      .select('*')
      .eq('household_id', household_id);

    console.log(`Relatives in household:`, { relatives, relativeError });

    return new Response(JSON.stringify({
      success: true,
      debug_info: {
        device_pairs: devicePairs,
        household_members: householdMembers,
        all_claimed_pairs: allPairs,
        relatives: relatives
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in debug-fcm-tokens:', error);
    return new Response(JSON.stringify({
      error: 'debug_failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});