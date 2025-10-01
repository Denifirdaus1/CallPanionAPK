import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
if (!fcmServiceAccountJson) {
  throw new Error('FCM_SERVICE_ACCOUNT_JSON not configured');
}

const svc = JSON.parse(fcmServiceAccountJson);

// Manual JWT generation for Google OAuth
async function createJWT(clientEmail: string, privateKey: string, scopes: string[]): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/[+\/=]/g, (m) => {
    const mapping: { [key: string]: string } = { '+': '-', '/': '_', '=': '' };
    return mapping[m] || m;
  });
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/[+\/=]/g, (m) => {
    const mapping: { [key: string]: string } = { '+': '-', '/': '_', '=': '' };
    return mapping[m] || m;
  });

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  
  // Import the private key
  const keyData = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '')
                            .replace(/-----END PRIVATE KEY-----/, '')
                            .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
                        .replace(/[+\/=]/g, (m) => {
                          const mapping: { [key: string]: string } = { '+': '-', '/': '_', '=': '' };
                          return mapping[m] || m;
                        });

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function getAccessToken(): Promise<string> {
  const jwt = await createJWT(
    svc.client_email,
    svc.private_key,
    ['https://www.googleapis.com/auth/firebase.messaging']
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }

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
      userId,
      user_ids,
      title,
      body,
      data = {},
      householdId,
      relativeId
    } = await req.json();

    if (!title || !body) {
      throw new Error('Missing required fields: title, body');
    }

    // Determine target user IDs (support both single userId and multiple user_ids)
    const targetUserIds: string[] = [];
    if (userId) {
      targetUserIds.push(userId);
    }
    if (user_ids && Array.isArray(user_ids)) {
      targetUserIds.push(...user_ids);
    }

    if (targetUserIds.length === 0) {
      throw new Error('No user IDs provided (userId or user_ids)');
    }

    console.log(`Sending push notification to ${targetUserIds.length} users: ${title}`);

    const projectId = svc.project_id;
    const accessToken = await getAccessToken();

    let successCount = 0;
    let failureCount = 0;
    const results: any[] = [];

    // Try device_pairs first (new pairing system)
    let tokens: any[] = [];
    
    if (householdId && relativeId) {
      console.log('Using device_pairs for notification lookup:', { householdId, relativeId });
      
      // Get FCM token from device_pairs for the specific household + relative
      const { data: devicePairs, error: pairsError } = await supabase
        .from('device_pairs')
        .select('household_id, relative_id, device_info, claimed_by')
        .eq('household_id', householdId)
        .eq('relative_id', relativeId)
        .not('claimed_at', 'is', null)
        .not('device_info', 'is', null);

      if (!pairsError && devicePairs) {
        for (const pair of devicePairs) {
          const fcmToken = pair.device_info?.fcm_token;
          const platform = pair.device_info?.platform || 'android';
          
          if (fcmToken) {
            tokens.push({
              user_id: pair.claimed_by,
              token: fcmToken,
              platform: platform,
              source: 'device_pairs'
            });
            console.log('Found FCM token via device_pairs:', { token: fcmToken, platform });
          }
        }
      } else {
        console.log('Error or no device_pairs found:', pairsError);
      }
    }
    
    // Fallback to push_notification_tokens for broader notifications or if no device_pairs found
    if (tokens.length === 0 && targetUserIds.length > 0) {
      console.log('Falling back to push_notification_tokens');
      
      const { data: fallbackTokens, error: tokensError } = await supabase
        .from('push_notification_tokens')
        .select('user_id, token, platform')
        .in('user_id', targetUserIds)
        .eq('is_active', true);

      if (!tokensError && fallbackTokens) {
        tokens = fallbackTokens.map(t => ({ ...t, source: 'push_notification_tokens' }));
      }
    }

    if (tokens.length === 0) {
      console.log('No FCM tokens found via device_pairs or push_notification_tokens');
      return new Response(JSON.stringify({
        success: true,
        message: 'No FCM tokens found',
        sent: 0,
        failed: 0,
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${tokens.length} FCM tokens to send notifications to`);

    // Send notification to each token
    for (const tokenRecord of tokens) {
      try {
        // Check if this is an iOS device with VoIP capability for incoming calls
        const isIncomingCall = data.type === 'incoming_call';
        const isIOS = tokenRecord.platform === 'ios';

        if (isIncomingCall && isIOS) {
          // For iOS incoming calls, try to use APNS VoIP notification first
          console.log(`Attempting APNS VoIP notification for iOS user ${tokenRecord.user_id}`);

          // Get VoIP token from device pairing or push_notification_tokens
          let voipToken = null;

          // Check if VoIP token is available in push_notification_tokens
          const { data: voipTokenData, error: voipError } = await supabase
            .from('push_notification_tokens')
            .select('voip_token')
            .eq('user_id', tokenRecord.user_id)
            .eq('is_active', true)
            .not('voip_token', 'is', null)
            .limit(1)
            .single();

          if (!voipError && voipTokenData?.voip_token) {
            voipToken = voipTokenData.voip_token;
          }

          if (voipToken) {
            // Use APNS VoIP notification
            try {
              const { error: apnsError } = await supabase.functions.invoke('send-apns-voip-notification', {
                body: {
                  voipToken: voipToken,
                  deviceToken: tokenRecord.token,
                  title: title,
                  body: body,
                  data: data,
                  householdId: householdId,
                  relativeId: relativeId,
                  callSessionId: data.sessionId
                }
              });

              if (!apnsError) {
                console.log(`APNS VoIP notification sent successfully to user ${tokenRecord.user_id}`);
                successCount++;
                results.push({
                  user_id: tokenRecord.user_id,
                  platform: tokenRecord.platform,
                  success: true,
                  notification_type: 'apns_voip',
                  message: 'APNS VoIP notification sent'
                });
                continue; // Skip FCM for this user
              } else {
                console.warn(`APNS VoIP failed for user ${tokenRecord.user_id}, falling back to FCM:`, apnsError);
              }
            } catch (apnsError) {
              console.warn(`APNS VoIP error for user ${tokenRecord.user_id}, falling back to FCM:`, apnsError);
            }
          } else {
            console.log(`No VoIP token found for iOS user ${tokenRecord.user_id}, using FCM`);
          }
        }

        // Use FCM for Android devices or iOS fallback
        const fcmV1Payload = {
          message: {
            token: tokenRecord.token,
            notification: {
              title: title,
              body: body
            },
            data: toStringMap({
              ...data,
              type: data.type || 'general',
              user_id: tokenRecord.user_id,
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
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                channel_id: 'callpanion_calls',
                icon: '@drawable/ic_notification'
              },
              data: toStringMap({
                ...data,
                type: data.type || 'general',
                user_id: tokenRecord.user_id,
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

        if (fcmResponse.ok) {
          successCount++;
          results.push({
            user_id: tokenRecord.user_id,
            platform: tokenRecord.platform,
            success: true,
            message_id: fcmResult.name
          });

          // Log successful notification
          await supabase
            .from('push_notifications')
            .insert({
              device_token: tokenRecord.token,
              user_id: tokenRecord.user_id,
              title: title,
              body: body,
              data: data,
              status: 'sent',
              fcm_response: fcmResult
            });

          console.log(`Push notification sent to user ${tokenRecord.user_id} (${tokenRecord.platform})`);
        } else {
          failureCount++;
          results.push({
            user_id: tokenRecord.user_id,
            platform: tokenRecord.platform,
            success: false,
            error: fcmResult.error || 'Unknown FCM error'
          });

          // Log failed notification
          await supabase
            .from('push_notifications')
            .insert({
              device_token: tokenRecord.token,
              user_id: tokenRecord.user_id,
              title: title,
              body: body,
              data: data,
              status: 'failed',
              error_message: JSON.stringify(fcmResult.error)
            });

          console.error(`Failed to send push notification to user ${tokenRecord.user_id}:`, fcmResult);
        }
      } catch (error) {
        failureCount++;
        results.push({
          user_id: tokenRecord.user_id,
          platform: tokenRecord.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        console.error(`Error sending push notification to user ${tokenRecord.user_id}:`, error);
      }
    }

    console.log(`Push notification batch completed: ${successCount} sent, ${failureCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent: successCount,
      failed: failureCount,
      total_tokens: tokens.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(JSON.stringify({
      error: 'notification_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});