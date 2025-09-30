import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
if (!fcmServiceAccountJson) {
  throw new Error('FCM_SERVICE_ACCOUNT_JSON not configured');
}

const svc = JSON.parse(fcmServiceAccountJson);

// Simple JWT creation for FCM v1 API
async function createJWT(clientEmail: string, privateKey: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/[+\/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' }[m] || m));
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/[+\/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' }[m] || m));
  
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  
  // Clean private key
  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256'
  }, false, ['sign']);

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/[+\/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' }[m] || m));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function getAccessToken(): Promise<string> {
  const jwt = await createJWT(svc.client_email, svc.private_key);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OAuth failed: ${errorData.error_description || errorData.error}`);
  }

  const data = await response.json();
  return data.access_token;
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

    // Prepare FCM V1 payload according to official documentation
    // https://firebase.google.com/docs/cloud-messaging/send/v1-api
    const fcmV1Payload = {
      message: {
        token: deviceToken,
        notification: {
          title: title,
          body: body
        },
        data: toStringMap({
          ...data,
          type: data.type || 'general',
          household_id: String(householdId || ''),
          relative_id: String(relativeId || ''),
          timestamp: Date.now().toString()
        }),
        android: {
          priority: 'high',
          notification: {
            title: title,
            body: body,
            sound: 'default',
            channel_id: 'callpanion_calls',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            icon: '@drawable/ic_notification'
          },
          data: toStringMap({
            ...data,
            type: data.type || 'general',
            household_id: String(householdId || ''),
            relative_id: String(relativeId || ''),
            timestamp: Date.now().toString()
          })
        },
        apns: {
          headers: {
            'apns-priority': '10'
          },
          payload: {
            aps: {
              alert: {
                title: title,
                body: body
              },
              sound: 'default',
              'content-available': 1,
              badge: 1
            }
          }
        }
      }
    };

    // Send FCM V1 notification to official endpoint
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    console.log('📤 Sending FCM v1 request to:', fcmEndpoint);
    console.log('📤 Payload:', JSON.stringify(fcmV1Payload, null, 2));
    
    const fcmResponse = await fetch(fcmEndpoint, {
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
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});