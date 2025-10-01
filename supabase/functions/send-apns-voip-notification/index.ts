import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT token cache with expiration
let cachedJWT: { token: string; expiresAt: number } | null = null;

// Generate JWT token for APNS authentication
async function generateAPNSJWT(): Promise<string> {
  // Check if cached token is still valid (refresh 5 minutes before expiry)
  const now = Math.floor(Date.now() / 1000);
  if (cachedJWT && cachedJWT.expiresAt > now + 300) {
    console.log('Using cached APNS JWT token');
    return cachedJWT.token;
  }

  console.log('Generating new APNS JWT token');
  
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const keyBase64 = Deno.env.get('APNS_KEY_BASE64');

  if (!keyId || !teamId || !keyBase64) {
    throw new Error('Missing APNS configuration: APNS_KEY_ID, APNS_TEAM_ID, or APNS_KEY_BASE64');
  }

  // JWT Header
  const header = {
    alg: 'ES256',
    kid: keyId
  };

  // JWT Payload (expires in 60 minutes)
  const issuedAt = now;
  const expiresAt = issuedAt + 3600; // 1 hour
  const payload = {
    iss: teamId,
    iat: issuedAt,
    exp: expiresAt
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Create signing string
  const signingString = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    privateKey,
    new TextEncoder().encode(signingString)
  );

  // Encode signature
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signingString}.${encodedSignature}`;

  // Cache the token
  cachedJWT = {
    token: jwt,
    expiresAt: expiresAt
  };

  console.log(`Generated APNS JWT token, expires at: ${new Date(expiresAt * 1000).toISOString()}`);
  return jwt;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const { 
      voipToken, 
      deviceToken,
      title, 
      body, 
      data = {},
      householdId,
      relativeId,
      callSessionId 
    } = await req.json();

    console.log('=== send-apns-voip-notification triggered ===');
    console.log('VoIP Token:', voipToken ? 'provided' : 'missing');
    console.log('Device Token:', deviceToken ? 'provided' : 'missing');
    console.log('Title:', title);
    console.log('Body:', body);

    const bundleId = Deno.env.get('APNS_BUNDLE_ID');
    const topicVoIP = Deno.env.get('APNS_TOPIC_VOIP');
    const apnsEnv = Deno.env.get('APNS_ENV') || 'sandbox';

    if (!bundleId || !topicVoIP) {
      throw new Error('Missing APNS configuration: APNS_BUNDLE_ID or APNS_TOPIC_VOIP');
    }

    // Prefer VoIP token for voice calls, fallback to device token
    const targetToken = voipToken || deviceToken;
    if (!targetToken) {
      throw new Error('No VoIP token or device token provided');
    }

    const isVoIP = !!voipToken;
    console.log(`Using ${isVoIP ? 'VoIP' : 'regular'} token for notification`);

    // Generate JWT token
    const jwtToken = await generateAPNSJWT();

    // APNS server URL
    const apnsServer = apnsEnv === 'production' 
      ? 'https://api.push.apple.com' 
      : 'https://api.sandbox.push.apple.com';

    // Create APNS payload
    const apnsPayload = {
      aps: {
        alert: {
          title: title,
          body: body
        },
        sound: isVoIP ? 'default' : 'default',
        badge: 1,
        'content-available': 1,
        'mutable-content': 1,
        ...(isVoIP && {
          // VoIP specific properties
          category: 'INCOMING_CALL',
          'interruption-level': 'critical'
        })
      },
      // Custom data
      type: data.type || 'incoming_call',
      call_session_id: callSessionId,
      household_id: householdId,
      relative_id: relativeId,
      timestamp: Date.now(),
      ...data
    };

    console.log('APNS Payload:', JSON.stringify(apnsPayload, null, 2));

    // Send to APNS
    const apnsUrl = `${apnsServer}/3/device/${targetToken}`;
    const apnsHeaders = {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
      'apns-topic': isVoIP ? topicVoIP : bundleId,
      'apns-priority': '10',
      'apns-push-type': isVoIP ? 'voip' : 'alert',
      'apns-expiration': '0'
    };

    console.log('Sending to APNS:', apnsUrl);
    console.log('APNS Headers:', JSON.stringify(apnsHeaders, null, 2));

    const apnsResponse = await fetch(apnsUrl, {
      method: 'POST',
      headers: apnsHeaders,
      body: JSON.stringify(apnsPayload)
    });

    const responseText = await apnsResponse.text();
    console.log('APNS Response Status:', apnsResponse.status);
    console.log('APNS Response Body:', responseText);

    let apnsResult: any = {};
    if (responseText) {
      try {
        apnsResult = JSON.parse(responseText);
      } catch {
        apnsResult = { raw_response: responseText };
      }
    }

    if (apnsResponse.ok) {
      console.log('✅ APNS notification sent successfully');

      // Log successful notification in database
      const { error: logError } = await supabase
        .from('push_notifications')
        .insert({
          device_token: targetToken,
          title: title,
          body: body,
          data: data,
          status: 'sent',
          platform: 'ios',
          notification_type: isVoIP ? 'voip' : 'alert',
          apns_response: apnsResult
        });

      if (logError) {
        console.error('Failed to log notification:', logError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'APNS notification sent successfully',
        notification_type: isVoIP ? 'voip' : 'alert',
        apns_id: apnsResponse.headers.get('apns-id'),
        response: apnsResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      console.error('❌ APNS notification failed:', apnsResponse.status, responseText);

      // Log failed notification
      const { error: logError } = await supabase
        .from('push_notifications')
        .insert({
          device_token: targetToken,
          title: title,
          body: body,
          data: data,
          status: 'failed',
          platform: 'ios',
          notification_type: isVoIP ? 'voip' : 'alert',
          error_message: responseText,
          apns_response: apnsResult
        });

      if (logError) {
        console.error('Failed to log failed notification:', logError);
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'APNS notification failed',
        status: apnsResponse.status,
        apns_error: apnsResult,
        response: responseText
      }), {
        status: apnsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in send-apns-voip-notification function:', error);
    return new Response(JSON.stringify({ 
      error: 'apns_notification_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});