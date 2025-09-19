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

// Enhanced retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  timeout: 10000
};

// Enhanced error types for push notifications
enum PushNotificationErrorType {
  TOKEN_INVALID = 'TOKEN_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  DEVICE_NOT_REGISTERED = 'DEVICE_NOT_REGISTERED'
}

class PushNotificationError extends Error {
  constructor(
    public type: PushNotificationErrorType,
    message: string,
    public retryable: boolean = false,
    public userId?: string
  ) {
    super(message);
    this.name = 'PushNotificationError';
  }
}

// Enhanced access token generation with retry
async function getAccessToken(): Promise<string> {
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const client = await auth.getClient();
      const { token } = await client.getAccessToken();
      if (!token) throw new Error("Failed to mint access token");
      return token;
    } catch (error) {
      if (attempt === RETRY_CONFIG.maxRetries) {
        throw new PushNotificationError(
          PushNotificationErrorType.AUTH_ERROR,
          `Failed to get access token after ${RETRY_CONFIG.maxRetries} attempts: ${error.message}`,
          false
        );
      }

      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
      );

      console.warn(`[PushNotification] Access token attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable code');
}

function toStringMap(obj: Record<string, unknown> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

// Enhanced FCM error handling
function mapFCMErrorToType(fcmError: any): PushNotificationErrorType {
  const errorCode = fcmError?.code || fcmError?.errorCode || '';
  const errorMessage = fcmError?.message || '';

  if (errorCode.includes('UNREGISTERED') || errorCode.includes('NOT_FOUND')) {
    return PushNotificationErrorType.DEVICE_NOT_REGISTERED;
  }
  if (errorCode.includes('INVALID') || errorCode.includes('MALFORMED')) {
    return PushNotificationErrorType.TOKEN_INVALID;
  }
  if (errorCode.includes('QUOTA_EXCEEDED') || errorCode.includes('RATE_LIMIT')) {
    return PushNotificationErrorType.RATE_LIMIT_EXCEEDED;
  }
  if (errorCode.includes('PAYLOAD_SIZE_LIMIT_EXCEEDED')) {
    return PushNotificationErrorType.PAYLOAD_TOO_LARGE;
  }
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('timeout')) {
    return PushNotificationErrorType.NETWORK_ERROR;
  }

  return PushNotificationErrorType.NETWORK_ERROR; // Default fallback
}

// Enhanced retry mechanism for FCM requests
async function sendFCMWithRetry(
  projectId: string,
  accessToken: string,
  payload: any,
  userId: string
): Promise<any> {
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), RETRY_CONFIG.timeout);
      });

      const fcmRequest = fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const fcmResponse = await Promise.race([fcmRequest, timeoutPromise]);
      const fcmResult = await fcmResponse.json();

      if (fcmResponse.ok) {
        return { success: true, result: fcmResult, attempt: attempt + 1 };
      }

      // Check if error is retryable
      const errorType = mapFCMErrorToType(fcmResult.error);
      const isRetryable = [
        PushNotificationErrorType.RATE_LIMIT_EXCEEDED,
        PushNotificationErrorType.NETWORK_ERROR
      ].includes(errorType);

      if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
        throw new PushNotificationError(
          errorType,
          `FCM error: ${fcmResult.error?.message || 'Unknown error'}`,
          isRetryable,
          userId
        );
      }

      // Calculate delay for retryable errors
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
      );

      console.warn(`[PushNotification] FCM attempt ${attempt + 1} failed for user ${userId}, retrying in ${delay}ms:`, fcmResult.error);
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (error) {
      if (error instanceof PushNotificationError) {
        throw error;
      }

      if (attempt === RETRY_CONFIG.maxRetries) {
        throw new PushNotificationError(
          PushNotificationErrorType.NETWORK_ERROR,
          `Network error after ${RETRY_CONFIG.maxRetries} attempts: ${error.message}`,
          true,
          userId
        );
      }

      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
      );

      console.warn(`[PushNotification] Network attempt ${attempt + 1} failed for user ${userId}, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable code');
}

// Enhanced notification logging with more details
async function logNotificationResult(
  supabase: any,
  tokenRecord: any,
  title: string,
  body: string,
  data: any,
  result: any,
  notificationType: string = 'fcm'
): Promise<void> {
  try {
    await supabase
      .from('push_notifications')
      .insert({
        device_token: tokenRecord.token,
        user_id: tokenRecord.user_id,
        title: title,
        body: body,
        data: data,
        status: result.success ? 'sent' : 'failed',
        notification_type: notificationType,
        platform: tokenRecord.platform,
        ...(result.success && { fcm_response: result.result }),
        ...(result.error && { error_message: result.error }),
        ...(result.attempt && { retry_attempts: result.attempt }),
        created_at: new Date().toISOString()
      });
  } catch (logError) {
    console.warn(`[PushNotification] Failed to log notification result for user ${tokenRecord.user_id}:`, logError.message);
    // Don't throw - logging failures shouldn't block notification flow
  }
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

    console.log(`[PushNotification] Sending push notification to ${targetUserIds.length} users: ${title}`);

    const projectId = svc.project_id;
    const accessToken = await getAccessToken();

    let successCount = 0;
    let failureCount = 0;
    const results: any[] = [];
    const errors: any[] = [];

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
        
        // Enhanced FCM payload with improved targeting
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
              timestamp: Date.now().toString(),
              notification_id: `${Date.now()}_${tokenRecord.user_id}`
            },
            android: {
              priority: 'high',
              notification: {
                sound: data.type === 'incoming_call' ? 'call_ringtone' : 'default',
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                channel_id: data.type === 'incoming_call' ? 'call_notifications' : 'general_notifications',
                tag: data.type === 'incoming_call' ? 'incoming_call' : 'general',
                ...(data.type === 'incoming_call' && {
                  ongoing: true,
                  auto_cancel: false,
                  actions: [
                    { action: 'ACCEPT_CALL', title: 'Accept' },
                    { action: 'DECLINE_CALL', title: 'Decline' }
                  ]
                })
              },
              data: {
                ...toStringMap(data),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
              }
            },
            apns: {
              headers: {
                'apns-priority': data.type === 'incoming_call' ? '10' : '5',
                'apns-push-type': 'alert',
                ...(data.type === 'incoming_call' && { 'apns-expiration': '0' })
              },
              payload: {
                aps: {
                  sound: data.type === 'incoming_call' ? 'call_ringtone.wav' : 'default',
                  'content-available': 1,
                  alert: {
                    title: title,
                    body: body
                  },
                  badge: 1,
                  ...(data.type === 'incoming_call' && {
                    category: 'INCOMING_CALL',
                    'thread-id': `call_${data.sessionId || 'unknown'}`
                  })
                },
                custom_data: data
              }
            }
          }
        };

        // Send FCM V1 notification with enhanced retry
        try {
          console.log(`[PushNotification] Sending FCM notification to user ${tokenRecord.user_id} (${tokenRecord.platform})`);

          const fcmResult = await sendFCMWithRetry(
            projectId,
            accessToken,
            fcmV1Payload,
            tokenRecord.user_id
          );

          successCount++;
          results.push({
            user_id: tokenRecord.user_id,
            platform: tokenRecord.platform,
            success: true,
            message_id: fcmResult.result.name,
            notification_type: 'fcm',
            retry_attempts: fcmResult.attempt
          });

          // Enhanced notification logging
          await logNotificationResult(
            supabase,
            tokenRecord,
            title,
            body,
            data,
            fcmResult,
            'fcm'
          );

          console.log(`[PushNotification] ✅ FCM notification sent to user ${tokenRecord.user_id} (${tokenRecord.platform}) after ${fcmResult.attempt} attempt(s)`);

        } catch (fcmError) {
          if (fcmError instanceof PushNotificationError) {
            failureCount++;

            results.push({
              user_id: tokenRecord.user_id,
              platform: tokenRecord.platform,
              success: false,
              error: fcmError.message,
              error_type: fcmError.type,
              retryable: fcmError.retryable,
              notification_type: 'fcm'
            });

            errors.push({
              user_id: tokenRecord.user_id,
              error_type: fcmError.type,
              message: fcmError.message,
              retryable: fcmError.retryable
            });

            // Enhanced error logging
            await logNotificationResult(
              supabase,
              tokenRecord,
              title,
              body,
              data,
              { success: false, error: fcmError.message, error_type: fcmError.type },
              'fcm'
            );

            console.error(`[PushNotification] ❌ FCM notification failed for user ${tokenRecord.user_id}: ${fcmError.type} - ${fcmError.message}`);

            // Handle specific error types
            if (fcmError.type === PushNotificationErrorType.DEVICE_NOT_REGISTERED ||
                fcmError.type === PushNotificationErrorType.TOKEN_INVALID) {
              // Mark token as inactive
              try {
                await supabase
                  .from('push_notification_tokens')
                  .update({ is_active: false, updated_at: new Date().toISOString() })
                  .eq('token', tokenRecord.token);

                console.log(`[PushNotification] Marked token as inactive for user ${tokenRecord.user_id} due to ${fcmError.type}`);
              } catch (updateError) {
                console.warn(`[PushNotification] Failed to mark token as inactive:`, updateError.message);
              }
            }
          } else {
            // Unexpected error
            failureCount++;

            results.push({
              user_id: tokenRecord.user_id,
              platform: tokenRecord.platform,
              success: false,
              error: fcmError.message,
              error_type: 'UNEXPECTED_ERROR',
              retryable: false,
              notification_type: 'fcm'
            });

            console.error(`[PushNotification] ❌ Unexpected error for user ${tokenRecord.user_id}:`, fcmError.message);
          }
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

    // Enhanced summary with error breakdown
    const errorBreakdown = {
      token_invalid: errors.filter(e => e.error_type === PushNotificationErrorType.TOKEN_INVALID).length,
      device_not_registered: errors.filter(e => e.error_type === PushNotificationErrorType.DEVICE_NOT_REGISTERED).length,
      rate_limit_exceeded: errors.filter(e => e.error_type === PushNotificationErrorType.RATE_LIMIT_EXCEEDED).length,
      network_errors: errors.filter(e => e.error_type === PushNotificationErrorType.NETWORK_ERROR).length,
      auth_errors: errors.filter(e => e.error_type === PushNotificationErrorType.AUTH_ERROR).length,
      other_errors: errors.filter(e => !Object.values(PushNotificationErrorType).includes(e.error_type as PushNotificationErrorType)).length
    };

    const retryableErrorsCount = errors.filter(e => e.retryable).length;
    const successRate = tokens.length > 0 ? Math.round((successCount / tokens.length) * 100) : 100;

    console.log(`[PushNotification] ✅ Batch completed: ${successCount} sent, ${failureCount} failed (${successRate}% success rate)`);
    if (errors.length > 0) {
      console.log(`[PushNotification] 📋 Error breakdown:`, errorBreakdown);
      console.log(`[PushNotification] 🔄 Retryable errors: ${retryableErrorsCount}/${errors.length}`);
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        sent: successCount,
        failed: failureCount,
        total_tokens: tokens.length,
        total_users: targetUserIds.length,
        success_rate: successRate
      },
      error_breakdown: errorBreakdown,
      retryable_errors: retryableErrorsCount,
      results: results,
      timestamp: new Date().toISOString(),
      notification_metadata: {
        title: title,
        type: data.type || 'general',
        household_id: householdId,
        relative_id: relativeId
      }
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