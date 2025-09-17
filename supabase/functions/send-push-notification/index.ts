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

    // Get FCM tokens for all target users
    const { data: tokens, error: tokensError } = await supabase
      .from('push_notification_tokens')
      .select('user_id, token, platform')
      .in('user_id', targetUserIds)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching push tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No active push tokens found for target users');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active push tokens found',
        sent: 0,
        failed: 0,
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
            data: {
              ...toStringMap(data),
              type: data.type || 'general',
              user_id: tokenRecord.user_id,
              household_id: String(householdId || ''),
              relative_id: String(relativeId || ''),
              timestamp: Date.now().toString()
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
              }
            },
            apns: {
              headers: {
                'apns-priority': '10'
              },
              payload: {
                aps: {
                  sound: 'default',
                  'content-available': 1,
                  alert: {
                    title: title,
                    body: body
                  }
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
          error: error.message
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
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});