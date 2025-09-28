import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleAuth } from "npm:google-auth-library@9";
import { serviceClient } from '../_shared/client.ts';

const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
if (!fcmServiceAccountJson) {
  throw new Error('FCM_SERVICE_ACCOUNT_JSON not configured');
}

const svc = JSON.parse(fcmServiceAccountJson);
const auth = new GoogleAuth({
  credentials: { client_email: svc.client_email, private_key: svc.private_key },
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to mint access token");
  return token;
}

function toStringMap(obj: Record<string, unknown> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

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
      title,
      body,
      data = {},
      householdId,
      relativeId
    } = await req.json();

    // SECURITY: Verify device token belongs to the specified household/relative
    if (deviceToken && householdId) {
      const { data: tokenValidation, error: validationError } = await supabase
        .from('device_pairs')
        .select('household_id, relative_id, device_info')
        .eq('household_id', householdId)
        .not('claimed_at', 'is', null)
        .single();

      if (validationError || !tokenValidation) {
        console.error('FCM Token validation failed:', validationError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid device token for household'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if device token matches paired device
      const pairedToken = tokenValidation.device_info?.fcm_token;
      if (pairedToken && pairedToken !== deviceToken) {
        console.error('FCM Token mismatch for household:', { householdId, relativeId });
        return new Response(JSON.stringify({
          success: false,
          error: 'Device token does not match paired device'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!deviceToken) {
      console.log('No device token provided, skipping FCM notification');
      return new Response(JSON.stringify({
        success: true,
        message: 'No device token available',
        sent: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!title || !body) {
      throw new Error('Missing required fields: title, body');
    }

    const projectId = svc.project_id;

    // Get OAuth 2.0 access token
    const accessToken = await getAccessToken();

    // Prepare FCM V1 payload
    const fcmV1Payload = {
      message: {
        token: deviceToken,
        notification: {
          title: title,
          body: body
        },
        data: {
          ...toStringMap(data),
          type: data.type || 'general',
          household_id: String(householdId || ''),
          relative_id: String(relativeId || ''),
          timestamp: Date.now().toString()
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'callpanion_calls',
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          data: {
            ...toStringMap(data),
            type: data.type || 'incoming_call',
            household_id: String(householdId || ''),
            relative_id: String(relativeId || ''),
            timestamp: Date.now().toString()
          }
        },
        apns: {
          headers: {
            'apns-priority': '10'
          },
          payload: {
            aps: {
              sound: 'default',
              'content-available': 1
            }
          }
        }
      }
    };

    // Send FCM V1 notification
    const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmV1Payload)
    });

    const fcmResult = await fcmResponse.json();

    if (!fcmResponse.ok) {
      console.error('FCM Error:', fcmResult);
      throw new Error(`FCM failed: ${fcmResult.error || 'Unknown error'}`);
    }

    // Log notification in database
    const { error: logError } = await supabase
      .from('push_notifications')
      .insert({
        device_token: deviceToken,
        title: title,
        body: body,
        data: data,
        status: 'sent',
        fcm_response: fcmResult
      });

    if (logError) {
      console.error('Failed to log notification:', logError);
      // Don't throw, notification was sent successfully
    }

    console.log('FCM V1 notification sent successfully:', {
      name: fcmResult.name
    });

    return new Response(JSON.stringify({
      success: true,
      messageId: fcmResult.name,
      fcmResponse: fcmResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-fcm-notification function:', error);
    return new Response(JSON.stringify({
      error: 'notification_failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});