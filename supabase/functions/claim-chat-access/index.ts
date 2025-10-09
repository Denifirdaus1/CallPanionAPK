import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaimChatAccessRequest {
  pairingToken: string;
  householdId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create service client (bypass RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Extract user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

  const { pairingToken, householdId }: ClaimChatAccessRequest = await req.json();

  console.log(`[claim-chat-access] User ${user.id} claiming access for household ${householdId}`);

  // Find device_pairs record by pairingToken and householdId
  const { data: devicePair, error: findError } = await supabase
    .from('device_pairs')
    .select('*')
    .eq('pair_token', pairingToken)
    .eq('household_id', householdId)
    .single();

  if (findError || !devicePair) {
    console.error('[claim-chat-access] Device pair not found:', findError);
    throw new Error('Device pairing not found. Please complete pairing first.');
  }

  // Validate: prevent double claim by different users
  // BUT allow first-time chat access for existing paired devices
  const hasExistingChatAccess = devicePair.device_info?.supabase_user_id
                              || devicePair.device_info?.anonymous_user_id;

  if (hasExistingChatAccess && devicePair.claimed_by !== user.id) {
    console.error('[claim-chat-access] Device already claimed by another user');
    throw new Error('This device is already claimed by another user');
  }

  // Log if this is first-time chat access vs re-claim
  if (!hasExistingChatAccess && devicePair.claimed_by) {
    console.log(`[claim-chat-access] First-time chat access for existing paired device. Old claimed_by: ${devicePair.claimed_by}, New: ${user.id}`);
  }

    // Update device_pairs with current user info (bypass RLS with service role)
    const { error: updateError } = await supabase
      .from('device_pairs')
      .update({
        claimed_by: user.id,
        device_info: {
          ...(devicePair.device_info || {}),
          supabase_user_id: user.id,
          anonymous_user_id: user.id,
          chat_access_claimed_at: new Date().toISOString(),
        },
      })
      .eq('id', devicePair.id);

    if (updateError) {
      console.error('[claim-chat-access] Failed to update device_pairs:', updateError);
      throw new Error('Failed to claim chat access');
    }

    console.log(`[claim-chat-access] ✅ Successfully claimed chat access for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Chat access claimed successfully',
        userId: user.id,
        householdId: householdId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[claim-chat-access] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
