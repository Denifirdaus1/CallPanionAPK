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
    
    const { 
      deviceToken, 
      pairingToken, 
      status = 'online',
      deviceInfo = {},
      appVersion,
      batteryLevel,
      connectionType 
    } = await req.json();

    if (!deviceToken && !pairingToken) {
      throw new Error('Either deviceToken or pairingToken is required');
    }

    let deviceId: string | null = null;
    let relativeId: string | null = null;
    let householdId: string | null = null;

    // If pairingToken provided, get device info
    if (pairingToken) {
      const { data: pairData, error: pairError } = await supabase
        .from('device_pairs')
        .select('relative_id, household_id, claimed_at')
        .eq('pair_token', pairingToken)
        .single();

      if (pairError || !pairData) {
        throw new Error('Invalid pairing token');
      }

      relativeId = pairData.relative_id;
      householdId = pairData.household_id;

      // Try to find existing device record
      if (deviceToken) {
        const { data: existingDevice } = await supabase
          .from('devices')
          .select('id')
          .eq('push_token', deviceToken)
          .single();

        deviceId = existingDevice?.id || null;
      }
    }

    // If deviceToken provided, try to find device record
    if (deviceToken && !deviceId) {
      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select('id, customer_id, household_id')
        .eq('push_token', deviceToken)
        .single();

      if (!deviceError && deviceData) {
        deviceId = deviceData.id;
        householdId = deviceData.household_id;
      }
    }

    // Create or update device record
    const deviceUpdateData = {
      push_token: deviceToken,
      last_sync: new Date().toISOString(),
      status: status === 'online' ? 'ACTIVE' : 'OFFLINE',
      metadata: {
        ...deviceInfo,
        app_version: appVersion,
        battery_level: batteryLevel,
        connection_type: connectionType,
        last_heartbeat: new Date().toISOString()
      },
      push_token_updated_at: deviceToken ? new Date().toISOString() : undefined
    };

    if (deviceId) {
      // Update existing device
      const { error: updateError } = await supabase
        .from('devices')
        .update(deviceUpdateData)
        .eq('id', deviceId);

      if (updateError) {
        console.error('Failed to update device:', updateError);
        throw new Error('Failed to update device status');
      }
    } else if (householdId && deviceToken) {
      // Create new device record
      const { data: newDevice, error: createError } = await supabase
        .from('devices')
        .insert({
          ...deviceUpdateData,
          household_id: householdId,
          type: 'MOBILE',
          status: status === 'online' ? 'ACTIVE' : 'OFFLINE'
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create device:', createError);
        // Don't throw error if device creation fails, heartbeat should still work
      } else {
        deviceId = newDevice.id;
      }
    }

    // Update device pair status if claimed
    if (pairingToken && status === 'online') {
      EdgeRuntime.waitUntil(
        supabase
          .from('device_pairs')
          .update({ 
            claimed_at: new Date().toISOString(),
            device_info: deviceInfo 
          })
          .eq('pair_token', pairingToken)
      );
    }

    // Log heartbeat activity
    EdgeRuntime.waitUntil(
      supabase
        .from('device_activity_log')
        .insert({
          device_id: deviceId,
          household_id: householdId,
          relative_id: relativeId,
          activity_type: 'heartbeat',
          status: status,
          metadata: {
            battery_level: batteryLevel,
            connection_type: connectionType,
            app_version: appVersion
          }
        })
        .catch(error => console.error('Failed to log device activity:', error))
    );

    console.log('Device heartbeat processed:', {
      deviceId,
      deviceToken: deviceToken ? `${deviceToken.substring(0, 10)}...` : null,
      status,
      householdId,
      relativeId
    });

    return new Response(JSON.stringify({
      success: true,
      deviceId: deviceId,
      status: status,
      timestamp: new Date().toISOString(),
      householdId: householdId,
      relativeId: relativeId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in device-heartbeat function:', error);
    return new Response(JSON.stringify({ 
      error: 'heartbeat_failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});