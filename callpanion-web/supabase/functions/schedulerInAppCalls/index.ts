import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced retry configuration for notifications
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000
};

// Enhanced error tracking
interface SchedulerError {
  type: 'SESSION_CREATION' | 'TOKEN_MISSING' | 'NOTIFICATION_FAILED' | 'DATABASE_ERROR';
  message: string;
  relativeId: string;
  householdId: string;
  retryable: boolean;
}

// Retry function for critical operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxRetries) break;

      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay
      );

      console.warn(`[Scheduler] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Enhanced notification sending with retry
async function sendNotificationWithRetry(
  supabase: any,
  notificationData: any,
  platform: string,
  retries = 2
): Promise<{ success: boolean; error?: any }> {
  return retryOperation(async () => {
    let result;

    if (platform === 'ios' && notificationData.voipToken) {
      // Send APNS VoIP notification for iOS
      result = await supabase.functions.invoke('send-apns-voip-notification', {
        body: notificationData
      });
    } else if (notificationData.deviceToken) {
      // Send FCM notification for Android or iOS fallback
      result = await supabase.functions.invoke('send-fcm-notification', {
        body: notificationData
      });
    } else {
      throw new Error('No suitable notification method available');
    }

    if (result.error) {
      throw new Error(`Notification failed: ${result.error.message || 'Unknown error'}`);
    }

    return { success: true };
  });
}

// Broadcast real-time update to household dashboard
async function broadcastCallScheduled(
  supabase: any,
  householdId: string,
  sessionData: any,
  relativeName: string
): Promise<void> {
  try {
    const channel = supabase.channel(`household:${householdId}`);
    await channel.send({
      type: 'broadcast',
      event: 'call_scheduled',
      payload: {
        session_id: sessionData.id,
        relative_id: sessionData.relative_id,
        relative_name: relativeName,
        household_id: householdId,
        call_type: 'in_app_call',
        status: 'scheduled',
        scheduled_time: sessionData.scheduled_time,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`[Scheduler] Broadcasted call_scheduled to household ${householdId}`);
  } catch (error) {
    console.warn('[Scheduler] Failed to broadcast call scheduled event:', error.message);
    // Don't throw - broadcasting is non-critical
  }
}

// Enhanced session creation with conversation tracking
async function createCallSessionWithTracking(
  supabase: any,
  schedule: any
): Promise<any> {
  return retryOperation(async () => {
    // Create call session for WebRTC
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .insert({
        household_id: schedule.household_id,
        relative_id: schedule.relative_id,
        status: 'scheduled',
        provider: 'webrtc',
        call_type: 'in_app_call',
        scheduled_time: new Date(schedule.run_at_unix * 1000).toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Session creation failed: ${sessionError.message}`);
    }

    // Also create a placeholder conversation record for tracking
    try {
      await supabase
        .from('conversations')
        .insert({
          session_id: `scheduled_${session.id}`,
          user_id: schedule.relative_id,
          status: 'scheduled',
          conversation_config: {
            call_type: 'in_app_call',
            session_id: session.id,
            household_id: schedule.household_id,
            relative_id: schedule.relative_id,
            scheduled_time: session.scheduled_time
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      console.log(`[Scheduler] Created conversation tracking for session ${session.id}`);
    } catch (convError) {
      console.warn('[Scheduler] Failed to create conversation tracking:', convError.message);
      // Don't fail session creation for conversation tracking errors
    }

    return session;
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== schedulerInAppCalls triggered ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);

    const supabase = serviceClient();

    console.log('Environment check passed, fetching due schedules for in-app calls...');

    // Get due schedules using the existing RPC function
    const { data: dueSchedules, error: scheduleError } = await supabase
      .rpc('rpc_find_due_schedules_next_min');

    if (scheduleError) {
      console.error('Error fetching due schedules:', scheduleError);
      throw scheduleError;
    }

    console.log(`Found ${dueSchedules?.length || 0} total due schedules:`, dueSchedules);

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log('No due schedules found for in-app calls');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No due schedules found for in-app calls',
        dispatched: 0,
        failed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group schedules by household to check call method preference
    const householdSchedules = new Map();
    for (const schedule of dueSchedules) {
      if (!householdSchedules.has(schedule.household_id)) {
        householdSchedules.set(schedule.household_id, []);
      }
      householdSchedules.get(schedule.household_id).push(schedule);
    }

    // Get household preferences and device pairings for all households
    const householdIds = Array.from(householdSchedules.keys());
    const { data: households, error: householdError } = await supabase
      .from('households')
      .select('id, call_method_preference')
      .in('id', householdIds);

    if (householdError) {
      console.error('Error fetching household preferences:', householdError);
      throw householdError;
    }

    // Get device pairings for all relevant relatives
    const relativeIds = dueSchedules.map(s => s.relative_id);
    const { data: devicePairings, error: deviceError } = await supabase
      .from('device_pairs')
      .select('relative_id, household_id, claimed_by, device_info')
      .in('relative_id', relativeIds)
      .not('claimed_at', 'is', null);

    if (deviceError) {
      console.error('Error fetching device pairings:', deviceError);
    }

    let inAppCallSchedules = [];

    // Include schedules if household prefers in-app calls OR if relative has paired device
    for (const household of households || []) {
      const schedules = householdSchedules.get(household.id) || [];
      
      for (const schedule of schedules) {
        const includeSchedule = 
          household.call_method_preference === 'in_app_call' ||
          (devicePairings && devicePairings.some(dp => 
            dp.relative_id === schedule.relative_id && 
            dp.household_id === schedule.household_id
          ));
        
        if (includeSchedule) {
          inAppCallSchedules.push(schedule);
        }
      }
    }

    console.log(`In-app call schedules to process: ${inAppCallSchedules.length}`);

    let successfulDispatches = 0;
    let failedDispatches = 0;
    const errors: SchedulerError[] = [];

    console.log(`[Scheduler] Processing ${inAppCallSchedules.length} in-app call schedules`);

    // Process in-app calls (WebRTC + Push Notifications)
    if (inAppCallSchedules.length > 0) {
      for (const schedule of inAppCallSchedules) {
        try {
          console.log(`[Scheduler] Processing in-app call for relative ${schedule.relative_id} in household ${schedule.household_id}`);

          // Create call session with enhanced tracking
          const session = await createCallSessionWithTracking(supabase, schedule);

          console.log(`[Scheduler] Created session ${session.id} for relative ${schedule.relative_id}`);

          // Check if we already have a call log for this relative/slot today
          const { data: existingLog, error: checkError } = await supabase
            .from('call_logs')
            .select('id')
            .eq('relative_id', schedule.relative_id)
            .eq('household_id', schedule.household_id)
            .eq('call_type', 'in_app_call')
            .gte('timestamp', new Date().toISOString().split('T')[0])
            .lt('timestamp', new Date(Date.now() + 86400000).toISOString().split('T')[0])
            .single();

          let callLog;
          if (existingLog) {
            console.log(`Call already logged today for relative ${schedule.relative_id}, skipping duplicate`);
            // Update existing call log
            const { data: updatedLog, error: updateError } = await supabase
              .from('call_logs')
              .update({
                call_outcome: 'initiated',
                session_id: session.id,
                timestamp: new Date(schedule.run_at_unix * 1000).toISOString()
              })
              .eq('id', existingLog.id)
              .select()
              .single();

            if (updateError) {
              console.error('Error updating existing call log:', updateError);
              failedDispatches++;
              continue;
            }
            callLog = updatedLog;
          } else {
            // Create new call log for in-app call
            const { data: newLog, error: logError } = await supabase
              .from('call_logs')
              .insert({
                user_id: schedule.relative_id,
                relative_id: schedule.relative_id,
                household_id: schedule.household_id,
                call_outcome: 'initiated',
                provider: 'webrtc',
                call_type: 'in_app_call',
                session_id: session.id,
                timestamp: new Date(schedule.run_at_unix * 1000).toISOString()
              })
              .select()
              .single();

            if (logError) {
              console.error('Error creating call log:', logError);
              failedDispatches++;
              continue;
            }
            callLog = newLog;
          }

          if (logError) {
            console.error('Error creating call log:', logError);
            failedDispatches++;
            continue;
          }

          // Get device pairing for this relative to determine platform and token
          console.log(`Searching for device pairing: household_id=${schedule.household_id}, relative_id=${schedule.relative_id}`);

          const { data: devicePair, error: deviceError } = await supabase
            .from('device_pairs')
            .select('claimed_by, device_info, created_at, claimed_at')
            .eq('household_id', schedule.household_id)
            .eq('relative_id', schedule.relative_id)
            .not('claimed_at', 'is', null);

          console.log(`Device pair query result:`, { devicePair, deviceError, count: devicePair?.length || 0 });

          let elderlyDeviceToken = null;
          let voipToken = null;
          let platform = 'unknown';
          let tokenSource = 'none';

          if (!deviceError && devicePair && devicePair.length > 0) {
            // Use the first (most recent) device pairing
            const activePair = devicePair[0];
            console.log(`Found device pairing:`, {
              claimed_by: activePair.claimed_by,
              device_info: activePair.device_info,
              claimed_at: activePair.claimed_at
            });

            // Determine platform from device info
            platform = activePair.device_info?.platform || 'unknown';
            console.log(`Detected platform: ${platform}`);

            // Get tokens based on platform
            if (platform === 'ios') {
              // For iOS, prefer VoIP token for incoming calls
              voipToken = activePair.device_info?.voip_token;
              elderlyDeviceToken = activePair.device_info?.fcm_token;
              tokenSource = 'device_pairs';

              console.log(`iOS device detected for relative ${schedule.relative_id}`);
              console.log(`VoIP token: ${voipToken ? 'available (' + voipToken.substring(0,20) + '...)' : 'missing'}`);
              console.log(`FCM token: ${elderlyDeviceToken ? 'available (' + elderlyDeviceToken.substring(0,20) + '...)' : 'missing'}`);

            } else if (platform === 'android') {
              // For Android, use FCM token
              elderlyDeviceToken = activePair.device_info?.fcm_token;
              tokenSource = 'device_pairs';
              console.log(`Android device detected for relative ${schedule.relative_id}`);
              console.log(`FCM token: ${elderlyDeviceToken ? 'available (' + elderlyDeviceToken.substring(0,20) + '...)' : 'missing'}`);
            } else {
              console.log(`Unknown platform: ${platform}, device_info:`, activePair.device_info);
            }

            // Fallback: get tokens from push_notification_tokens if not in device_info
            if (!elderlyDeviceToken && !voipToken && activePair.claimed_by) {
              console.log(`No tokens in device_info, checking push_notification_tokens for user ${activePair.claimed_by}`);

              const { data: fallbackTokens, error: fallbackError } = await supabase
                .from('push_notification_tokens')
                .select('token, platform, voip_token, created_at')
                .eq('user_id', activePair.claimed_by)
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(5); // Get multiple to debug

              console.log(`Push notification tokens query result:`, {
                tokens: fallbackTokens,
                error: fallbackError,
                count: fallbackTokens?.length || 0
              });

              if (!fallbackError && fallbackTokens && fallbackTokens.length > 0) {
                const latestToken = fallbackTokens[0];
                elderlyDeviceToken = latestToken.token;
                voipToken = latestToken.voip_token;
                platform = latestToken.platform || platform;
                tokenSource = 'push_notification_tokens';

                console.log(`Using fallback token: platform=${platform}, token=${elderlyDeviceToken ? elderlyDeviceToken.substring(0,20) + '...' : 'none'}`);
              } else {
                console.log(`No fallback tokens found for user ${activePair.claimed_by}`);
              }
            }
          } else {
            console.log(`No device pairing found or error:`, { deviceError, pairCount: devicePair?.length || 0 });

            // Alternative: try to find any active FCM tokens for this household
            console.log(`Searching for alternative FCM tokens for household ${schedule.household_id}`);

            const { data: householdMembers, error: memberError } = await supabase
              .from('household_members')
              .select('user_id')
              .eq('household_id', schedule.household_id);

            if (!memberError && householdMembers) {
              console.log(`Found ${householdMembers.length} household members`);

              for (const member of householdMembers) {
                const { data: memberTokens, error: tokenError } = await supabase
                  .from('push_notification_tokens')
                  .select('token, platform, voip_token')
                  .eq('user_id', member.user_id)
                  .eq('is_active', true)
                  .limit(1);

                if (!tokenError && memberTokens && memberTokens.length > 0) {
                  console.log(`Found alternative token for member ${member.user_id}: ${memberTokens[0].platform}`);
                  elderlyDeviceToken = memberTokens[0].token;
                  voipToken = memberTokens[0].voip_token;
                  platform = memberTokens[0].platform || 'unknown';
                  tokenSource = 'household_member_tokens';
                  break;
                }
              }
            }
          }

          console.log(`Platform: ${platform}, Token source: ${tokenSource}`);
          if (platform === 'ios') {
            console.log(`iOS tokens - VoIP: ${voipToken ? 'available' : 'missing'}, FCM: ${elderlyDeviceToken ? 'available' : 'missing'}`);
          } else {
            console.log(`${platform} token: ${elderlyDeviceToken ? 'available' : 'missing'}`);
          }

          if (elderlyDeviceToken || voipToken) {
            // Get relative info for notification
            const { data: relative, error: relativeError } = await supabase
              .from('relatives')
              .select('first_name, last_name')
              .eq('id', schedule.relative_id)
              .single();

            if (!relativeError && relative) {
              const relativeName = `${relative.first_name} ${relative.last_name}`;

              // Prepare notification data
              const notificationData = {
                voipToken: voipToken,
                deviceToken: elderlyDeviceToken,
                title: platform === 'ios' && voipToken ? 'Incoming Call' : 'Time for Your Call',
                body: platform === 'ios' && voipToken ?
                  `${relative.first_name} is calling` :
                  `Your family is ready to talk with you, ${relative.first_name}!`,
                data: {
                  type: 'incoming_call',
                  sessionId: session.id,
                  relativeName: relativeName,
                  householdId: schedule.household_id,
                  relativeId: schedule.relative_id,
                  callType: 'in_app_call',
                  handle: 'CallPanion',
                  avatar: '',
                  duration: '30000'
                },
                householdId: schedule.household_id,
                relativeId: schedule.relative_id,
                ...(session.id && { callSessionId: session.id })
              };

              // Send platform-specific notification with retry
              try {
                console.log(`[Scheduler] Sending ${platform === 'ios' && voipToken ? 'APNS VoIP' : 'FCM'} notification to ${platform} device for relative ${schedule.relative_id}`);

                const notificationResult = await sendNotificationWithRetry(
                  supabase,
                  notificationData,
                  platform
                );

                if (notificationResult.success) {
                  console.log(`[Scheduler] ✅ ${platform === 'ios' && voipToken ? 'APNS VoIP' : 'FCM'} notification sent successfully to relative ${schedule.relative_id} (${platform}, token from ${tokenSource})`);

                  // Broadcast to dashboard that call was scheduled
                  await broadcastCallScheduled(supabase, schedule.household_id, session, relativeName);

                } else {
                  throw new Error(notificationResult.error?.message || 'Notification failed');
                }

              } catch (pushError) {
                console.error(`[Scheduler] ❌ Notification to elderly device failed:`, pushError.message);

                errors.push({
                  type: 'NOTIFICATION_FAILED',
                  message: pushError.message,
                  relativeId: schedule.relative_id,
                  householdId: schedule.household_id,
                  retryable: true
                });

                // Don't increment failedDispatches here - session was created successfully
                // The notification failure is tracked separately
              }

              // Also notify family members that the call was scheduled
              const { data: familyMembers, error: familyError } = await supabase
                .from('household_members')
                .select('user_id')
                .eq('household_id', schedule.household_id);

              if (!familyError && familyMembers) {
                for (const member of familyMembers) {
                  try {
                    const { error: familyNotifyError } = await supabase.functions.invoke('send-push-notification', {
                      body: {
                        userId: member.user_id,
                        title: 'Call Scheduled',
                        body: `Scheduled call sent to ${relative.first_name} ${relative.last_name}`,
                        data: {
                          type: 'call_scheduled',
                          sessionId: session.id,
                          relativeName: `${relative.first_name} ${relative.last_name}`,
                          householdId: schedule.household_id,
                          relativeId: schedule.relative_id
                        }
                      }
                    });

                    if (familyNotifyError) {
                      console.error('Error sending family notification:', familyNotifyError);
                    }
                  } catch (familyPushError) {
                    console.error('Family notification failed:', familyPushError);
                  }
                }
              }
            }
          } else {
            console.warn(`[Scheduler] ❌ No FCM token available for relative ${schedule.relative_id} in household ${schedule.household_id} - skipping notification`);

            errors.push({
              type: 'TOKEN_MISSING',
              message: `No FCM/VoIP token available for notification (platform: ${platform}, token source: ${tokenSource})`,
              relativeId: schedule.relative_id,
              householdId: schedule.household_id,
              retryable: false
            });

            failedDispatches++;
            continue;
          }

          // Update daily tracking
          await supabase
            .from('daily_call_tracking')
            .upsert({
              relative_id: schedule.relative_id,
              household_id: schedule.household_id,
              call_date: new Date().toISOString().split('T')[0],
              [`${schedule.slot_type}_called`]: true,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'relative_id,household_id,call_date'
            });

          successfulDispatches++;
          console.log(`[Scheduler] ✅ Successfully scheduled in-app call for relative ${schedule.relative_id} - session ${session.id}`);

        } catch (error) {
          console.error(`[Scheduler] ❌ Error processing in-app call schedule for relative ${schedule.relative_id}:`, error.message);

          errors.push({
            type: error.message.includes('Session creation') ? 'SESSION_CREATION' :
                  error.message.includes('Database') ? 'DATABASE_ERROR' : 'DATABASE_ERROR',
            message: error.message,
            relativeId: schedule.relative_id,
            householdId: schedule.household_id,
            retryable: true
          });

          failedDispatches++;
        }
      }
    }

    // Enhanced heartbeat with detailed error tracking
    const heartbeatStatus = failedDispatches === 0 ? 'success' : 'partial_success';
    const notificationErrors = errors.filter(e => e.type === 'NOTIFICATION_FAILED').length;
    const tokenErrors = errors.filter(e => e.type === 'TOKEN_MISSING').length;
    const sessionErrors = errors.filter(e => e.type === 'SESSION_CREATION').length;
    const dbErrors = errors.filter(e => e.type === 'DATABASE_ERROR').length;

    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'callpanion-in-app-calls',
        last_run: new Date().toISOString(),
        status: heartbeatStatus,
        details: {
          summary: {
            scheduled_calls: successfulDispatches,
            failed_calls: failedDispatches,
            total_due_schedules: dueSchedules.length,
            in_app_schedules: inAppCallSchedules.length,
            success_rate: inAppCallSchedules.length > 0 ?
              Math.round((successfulDispatches / inAppCallSchedules.length) * 100) : 100
          },
          error_breakdown: {
            notification_failures: notificationErrors,
            missing_tokens: tokenErrors,
            session_creation_failures: sessionErrors,
            database_errors: dbErrors,
            total_errors: errors.length
          },
          errors: errors.slice(0, 10), // Keep last 10 errors for debugging
          timestamp: new Date().toISOString(),
          environment: {
            function_version: '2.0.0',
            enhanced_features: ['retry_mechanism', 'conversation_tracking', 'real_time_broadcasting']
          }
        }
      }, {
        onConflict: 'job_name'
      });

    console.log('=== schedulerInAppCalls completed ===');
    console.log(`[Scheduler] ✅ Successful dispatches: ${successfulDispatches}`);
    console.log(`[Scheduler] ❌ Failed dispatches: ${failedDispatches}`);
    if (errors.length > 0) {
      console.log(`[Scheduler] 📋 Error breakdown:`);
      console.log(`  - Notification failures: ${notificationErrors}`);
      console.log(`  - Missing tokens: ${tokenErrors}`);
      console.log(`  - Session creation failures: ${sessionErrors}`);
      console.log(`  - Database errors: ${dbErrors}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'In-app call scheduling completed',
      summary: {
        dispatched: successfulDispatches,
        failed: failedDispatches,
        total_due_schedules: dueSchedules.length,
        in_app_schedules: inAppCallSchedules.length,
        success_rate: inAppCallSchedules.length > 0 ?
          Math.round((successfulDispatches / inAppCallSchedules.length) * 100) : 100
      },
      error_breakdown: {
        notification_failures: notificationErrors,
        missing_tokens: tokenErrors,
        session_creation_failures: sessionErrors,
        database_errors: dbErrors
      },
      retryable_errors: errors.filter(e => e.retryable).length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in schedulerInAppCalls function:', error);
    
    // Log error to heartbeat
    const supabase = serviceClient();
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'callpanion-in-app-calls',
        last_run: new Date().toISOString(),
        status: 'error',
        details: {
          error: error.message,
          stack: error.stack
        }
      }, {
        onConflict: 'job_name'
      });

    return new Response(JSON.stringify({ 
      error: 'in_app_call_scheduling_failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});