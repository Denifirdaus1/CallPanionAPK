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
    const body = await req.json();
    console.log('📥 FCM token registration request received:', {
      hasUserId: !!body.userId,
      hasToken: !!body.token,
      hasPlatform: !!body.platform,
      platform: body.platform,
      payloadKeys: Object.keys(body)
    });

    const { 
      userId, 
      token, 
      platform, 
      voipToken, 
      deviceInfo,
      pairingToken,
      relativeId,
      householdId,
      deviceFingerprint 
    } = body;

    if (!userId || !token || !platform) {
      console.error('❌ Missing required fields:', {
        userId: !!userId,
        token: !!token,
        platform: !!platform,
        receivedPayload: body
      });
      throw new Error('userId, token, and platform are required');
    }

    console.log(`Registering FCM token for user ${userId} on ${platform}`, {
      hasPairingToken: !!pairingToken,
      hasHouseholdId: !!householdId,
      hasRelativeId: !!relativeId,
      hasDeviceFingerprint: !!deviceFingerprint
    });

    const supabase = serviceClient();

    // Enhanced security: If device claims to be paired, validate the pairing
    if (pairingToken && householdId && relativeId) {
      const { data: pairValidation, error: validationError } = await supabase
        .from('device_pairs')
        .select('household_id, relative_id, claimed_by')
        .eq('pair_token', pairingToken)
        .eq('household_id', householdId)
        .eq('relative_id', relativeId)
        .single();

      if (validationError || !pairValidation) {
        console.error('Invalid pairing credentials for FCM registration:', validationError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid pairing credentials - device not properly paired'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If pairing exists but claimed by different user, reject
      if (pairValidation.claimed_by && pairValidation.claimed_by !== userId) {
        console.error('FCM token registration rejected: device claimed by different user');
        return new Response(JSON.stringify({
          success: false,
          error: 'Device is already paired to another user'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if token already exists
    const { data: existingToken, error: checkError } = await supabase
      .from('push_notification_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('token', token)
      .eq('platform', platform)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing token:', checkError);
      throw checkError;
    }

    const tokenData = {
      user_id: userId,
      token: token,
      platform: platform,
      is_active: true,
      device_info: {
        ...deviceInfo,
        device_fingerprint: deviceFingerprint,
        registration_timestamp: new Date().toISOString(),
        security_validated: !!(pairingToken && householdId && relativeId)
      },
      updated_at: new Date().toISOString(),
      ...(voipToken && platform === 'ios' && { voip_token: voipToken })
    };

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from('push_notification_tokens')
        .update(tokenData)
        .eq('id', existingToken.id);

      if (updateError) {
        console.error('Error updating token:', updateError);
        throw updateError;
      }

      console.log(`Updated existing FCM token for user ${userId}`);
    } else {
      // Deactivate old tokens for this user and platform first
      await supabase
        .from('push_notification_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('platform', platform);

      // Insert new token
      const { error: insertError } = await supabase
        .from('push_notification_tokens')
        .insert({
          ...tokenData,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting token:', insertError);
        throw insertError;
      }

      console.log(`Registered new FCM token for user ${userId}`);
    }

    // Update both device_pairs and devices table for proper notification routing
    try {
      // Update device_pairs table (existing functionality)
      const { data: existingPair, error: fetchError } = await supabase
        .from('device_pairs')
        .select('device_info, relative_id, household_id')
        .eq('claimed_by', userId)
        .single();

      if (!fetchError && existingPair) {
        const updatedDeviceInfo = {
          ...existingPair.device_info,
          ...deviceInfo,
          fcm_token: token,
          platform: platform,
          ...(platform === 'ios' && voipToken && { voip_token: voipToken })
        };

        const { error: deviceError } = await supabase
          .from('device_pairs')
          .update({
            device_info: updatedDeviceInfo,
            updated_at: new Date().toISOString()
          })
          .eq('claimed_by', userId);

        if (deviceError) {
          console.warn('Could not update device pairing with FCM token:', deviceError);
        } else {
          console.log(`Updated device pairing with FCM token for user ${userId} on ${platform}`);
        }

        // Skip devices table update - using device_pairs only
        console.log(`Device pairing updated with FCM token for user ${userId} on ${platform}`);
      }
    } catch (deviceUpdateError) {
      console.warn('Device update failed:', deviceUpdateError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'FCM token registered successfully',
      userId,
      platform,
      hasVoipToken: !!voipToken
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error registering FCM token:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});