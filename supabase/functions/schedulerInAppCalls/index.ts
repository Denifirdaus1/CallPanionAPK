import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to process queued notifications
async function processQueuedNotifications(supabase: any, queuedNotifications: any[]) {
  let successfulDispatches = 0;
  let failedDispatches = 0;

  for (const notification of queuedNotifications) {
    try {
      console.log(`Executing queued notification for relative ${notification.relative_id}, slot ${notification.slot_type}`);

      // Mark notification as being processed
      await supabase
        .from('scheduled_notifications')
        .update({ status: 'processing', executed_at: new Date().toISOString() })
        .eq('id', notification.id);

      // Create call session for WebRTC
      const { data: session, error: sessionError } = await supabase
        .from('call_sessions')
        .insert({
          household_id: notification.household_id,
          relative_id: notification.relative_id,
          status: 'scheduled',
          provider: 'webrtc',
          call_type: 'in_app_call',
          scheduled_time: notification.scheduled_for
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating call session:', sessionError);
        await supabase
          .from('scheduled_notifications')
          .update({ status: 'failed', last_error: sessionError.message })
          .eq('id', notification.id);
        failedDispatches++;
        continue;
      }

      // Create call log
      const { data: callLog, error: logError } = await supabase
        .from('call_logs')
        .insert({
          user_id: notification.relative_id,
          relative_id: notification.relative_id,
          household_id: notification.household_id,
          call_outcome: 'initiated',
          provider: 'webrtc',
          call_type: 'in_app_call',
          session_id: session.id,
          timestamp: notification.scheduled_for
        })
        .select()
        .single();

      if (logError) {
        console.error('Error creating call log:', logError);
      }

      // Get relative info for notification
      const { data: relative, error: relativeError } = await supabase
        .from('relatives')
        .select('first_name, last_name')
        .eq('id', notification.relative_id)
        .single();

      if (relativeError || !relative) {
        console.error('Error fetching relative info:', relativeError);
        await supabase
          .from('scheduled_notifications')
          .update({ status: 'failed', last_error: 'Relative not found' })
          .eq('id', notification.id);
        failedDispatches++;
        continue;
      }

      // Send notification based on platform and available tokens
      let notificationSent = false;
      let notifyError = null;

      if (notification.platform === 'ios' && notification.device_token) {
        // Try VoIP notification for iOS
        console.log(`Sending APNS VoIP notification to iOS device for relative ${notification.relative_id}`);
        const { error } = await supabase.functions.invoke('send-apns-voip-notification', {
          body: {
            voipToken: notification.device_token,
            title: 'Incoming Call',
            body: `${relative.first_name} is calling`,
            data: {
              type: 'incoming_call',
              sessionId: session.id,
              relativeName: `${relative.first_name} ${relative.last_name}`,
              householdId: notification.household_id,
              relativeId: notification.relative_id,
              callType: 'in_app_call',
              handle: 'CallPanion',
              avatar: '',
              duration: '30000'
            },
            householdId: notification.household_id,
            relativeId: notification.relative_id,
            callSessionId: session.id
          }
        });

        if (!error) {
          notificationSent = true;
        } else {
          notifyError = error;
        }
      }

      // Fallback to FCM for Android or iOS fallback
      if (!notificationSent && notification.device_token) {
        console.log(`Sending FCM notification to ${notification.platform} device for relative ${notification.relative_id}`);
        const { error } = await supabase.functions.invoke('send-fcm-notification', {
          body: {
            deviceToken: notification.device_token,
            title: 'Time for Your Call',
            body: `Your family is ready to talk with you, ${relative.first_name}!`,
            data: {
              type: 'incoming_call',
              sessionId: session.id,
              relativeName: `${relative.first_name} ${relative.last_name}`,
              householdId: notification.household_id,
              relativeId: notification.relative_id,
              callType: 'in_app_call',
              handle: 'CallPanion',
              avatar: '',
              duration: '30000'
            },
            householdId: notification.household_id,
            relativeId: notification.relative_id
          }
        });

        if (!error) {
          notificationSent = true;
        } else {
          notifyError = error;
        }
      }

      if (notificationSent) {
        console.log(`Notification sent successfully for relative ${notification.relative_id}`);

        // Mark notification as sent
        await supabase
          .from('scheduled_notifications')
          .update({ status: 'sent' })
          .eq('id', notification.id);

        // Update daily call tracking
        await supabase
          .from('daily_call_tracking')
          .upsert({
            relative_id: notification.relative_id,
            household_id: notification.household_id,
            call_date: new Date().toISOString().split('T')[0],
            [`${notification.slot_type}_called`]: true
          }, {
            onConflict: 'relative_id,household_id,call_date'
          });

        successfulDispatches++;
      } else {
        console.error('Failed to send notification:', notifyError);

        // Mark notification as failed
        await supabase
          .from('scheduled_notifications')
          .update({
            status: 'failed',
            last_error: notifyError?.message || 'Failed to send notification',
            retry_count: notification.retry_count + 1
          })
          .eq('id', notification.id);

        failedDispatches++;
      }

    } catch (error) {
      console.error('Error processing queued notification:', error);

      // Mark notification as failed
      await supabase
        .from('scheduled_notifications')
        .update({
          status: 'failed',
          last_error: error.message,
          retry_count: notification.retry_count + 1
        })
        .eq('id', notification.id);

      failedDispatches++;
    }
  }

  return { successfulDispatches, failedDispatches };
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

    // Get due schedules using the updated RPC function with execution modes
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
        queued: 0,
        dispatched: 0,
        failed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Separate schedules by execution mode
    const schedulesToQueue = dueSchedules.filter(s => s.execution_mode === 'queue');
    const schedulesToExecute = dueSchedules.filter(s => s.execution_mode === 'execute');

    console.log(`Schedules to queue: ${schedulesToQueue.length}, to execute: ${schedulesToExecute.length}`);

    let queuedCount = 0;
    let successfulDispatches = 0;
    let failedDispatches = 0;

    // === PHASE 1: Queue upcoming schedules (5 minutes before execution) ===
    if (schedulesToQueue.length > 0) {
      console.log(`Processing ${schedulesToQueue.length} schedules for queuing...`);

      for (const schedule of schedulesToQueue) {
        try {
          // Get device pairing info for platform detection
          const { data: devicePair, error: deviceError } = await supabase
            .from('device_pairs')
            .select('claimed_by, device_info')
            .eq('household_id', schedule.household_id)
            .eq('relative_id', schedule.relative_id)
            .not('claimed_at', 'is', null)
            .limit(1);

          let deviceToken = null;
          let platform = 'unknown';

          if (!deviceError && devicePair && devicePair.length > 0) {
            const activePair = devicePair[0];
            platform = activePair.device_info?.platform || 'unknown';
            deviceToken = activePair.device_info?.fcm_token || activePair.device_info?.voip_token;
          }

          // Insert into notification queue
          const { error: queueError } = await supabase
            .from('scheduled_notifications')
            .insert({
              household_id: schedule.household_id,
              relative_id: schedule.relative_id,
              schedule_id: schedule.schedule_id,
              slot_type: schedule.slot_type,
              scheduled_for: new Date(schedule.run_at_unix * 1000).toISOString(),
              device_token: deviceToken,
              platform: platform,
              status: 'queued'
            });

          if (queueError) {
            console.error('Error queuing notification:', queueError);
            failedDispatches++;
          } else {
            console.log(`Queued notification for relative ${schedule.relative_id}, slot ${schedule.slot_type}, scheduled for ${new Date(schedule.run_at_unix * 1000).toISOString()}`);
            queuedCount++;
          }
        } catch (error) {
          console.error('Error processing queue item:', error);
          failedDispatches++;
        }
      }
    }

    // === PHASE 2: Execute notifications from queue (at scheduled time) ===
    if (schedulesToExecute.length > 0) {
      console.log(`Processing ${schedulesToExecute.length} schedules for execution...`);

      // Get queued notifications for execution
      const scheduleIds = schedulesToExecute.map(s => s.schedule_id);
      const { data: queuedNotifications, error: queueFetchError } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .in('schedule_id', scheduleIds)
        .eq('status', 'queued')
        .lte('scheduled_for', new Date().toISOString());

      if (queueFetchError) {
        console.error('Error fetching queued notifications:', queueFetchError);
        throw queueFetchError;
      }

      console.log(`Found ${queuedNotifications?.length || 0} queued notifications to execute`);

      if (queuedNotifications && queuedNotifications.length > 0) {
        await processQueuedNotifications(supabase, queuedNotifications);
      }
    }

    // Group remaining schedules by household for preference checking (legacy support)
    const householdSchedules = new Map();
    for (const schedule of dueSchedules.filter(s => s.execution_mode === 'none')) {
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

    // Process in-app calls (WebRTC + Push Notifications)
    if (inAppCallSchedules.length > 0) {
      for (const schedule of inAppCallSchedules) {
        try {
          console.log(`Processing in-app call for relative ${schedule.relative_id}`);

          // Create call session for WebRTC
          const { data: session, error: sessionError } = await supabase
            .from('call_sessions')
            .insert({
              household_id: schedule.household_id,
              relative_id: schedule.relative_id,
              status: 'scheduled',
              provider: 'webrtc',
              call_type: 'in_app_call',
              scheduled_time: new Date(schedule.run_at_unix * 1000).toISOString()
            })
            .select()
            .single();

          if (sessionError) {
            console.error('Error creating call session:', sessionError);
            failedDispatches++;
            continue;
          }

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
              // Send platform-specific notification to elderly device
              try {
                let notifyError = null;

                if (platform === 'ios' && voipToken) {
                  // Use APNS VoIP notification for iOS
                  console.log(`Sending APNS VoIP notification to iOS device for relative ${schedule.relative_id}`);
                  const { error } = await supabase.functions.invoke('send-apns-voip-notification', {
                    body: {
                      voipToken: voipToken,
                      deviceToken: elderlyDeviceToken,
                      title: 'Incoming Call',
                      body: `${relative.first_name} is calling`,
                      data: {
                        type: 'incoming_call',
                        sessionId: session.id,
                        relativeName: `${relative.first_name} ${relative.last_name}`,
                        householdId: schedule.household_id,
                        relativeId: schedule.relative_id,
                        callType: 'in_app_call',
                        handle: 'CallPanion',
                        avatar: '',
                        duration: '30000'
                      },
                      householdId: schedule.household_id,
                      relativeId: schedule.relative_id,
                      callSessionId: session.id
                    }
                  });
                  notifyError = error;

                } else if (elderlyDeviceToken) {
                  // Use FCM notification for Android or iOS fallback
                  console.log(`Sending FCM notification to ${platform} device for relative ${schedule.relative_id}`);
                  const { error } = await supabase.functions.invoke('send-fcm-notification', {
                    body: {
                      deviceToken: elderlyDeviceToken,
                      title: 'Time for Your Call',
                      body: `Your family is ready to talk with you, ${relative.first_name}!`,
                      data: {
                        type: 'incoming_call',
                        sessionId: session.id,
                        relativeName: `${relative.first_name} ${relative.last_name}`,
                        householdId: schedule.household_id,
                        relativeId: schedule.relative_id,
                        callType: 'in_app_call',
                        handle: 'CallPanion',
                        avatar: '',
                        duration: '30000'
                      },
                      householdId: schedule.household_id,
                      relativeId: schedule.relative_id
                    }
                  });
                  notifyError = error;
                } else {
                  throw new Error('No suitable token available for notification');
                }

                if (notifyError) {
                  console.error(`Error sending ${platform === 'ios' && voipToken ? 'APNS VoIP' : 'FCM'} notification to elderly device:`, notifyError);
                  failedDispatches++;
                } else {
                  console.log(`${platform === 'ios' && voipToken ? 'APNS VoIP' : 'FCM'} notification sent to elderly device for relative ${schedule.relative_id} (${platform}, token from ${tokenSource})`);
                }
              } catch (pushError) {
                console.error('Notification to elderly device failed:', pushError);
                // Don't fail the whole process for push notification issues
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
            console.warn(`No FCM token available for relative ${schedule.relative_id} in household ${schedule.household_id} - skipping notification`);
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
              [`${schedule.slot_type}_called`]: true
            }, {
              onConflict: 'relative_id,household_id,call_date'
            });

          successfulDispatches++;
          console.log(`Successfully scheduled in-app call for relative ${schedule.relative_id}`);

        } catch (error) {
          console.error('Error processing in-app call schedule:', error);
          failedDispatches++;
        }
      }
    }

    // Update heartbeat
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'callpanion-in-app-calls',
        last_run: new Date().toISOString(),
        status: 'success',
        details: {
          queued_notifications: queuedCount,
          executed_notifications: successfulDispatches,
          failed_dispatches: failedDispatches,
          total_due_schedules: dueSchedules.length,
          timestamp: new Date().toISOString()
        }
      }, {
        onConflict: 'job_name'
      });

    console.log('=== schedulerInAppCalls completed ===');
    console.log(`Queued notifications: ${queuedCount}`);
    console.log(`Successful dispatches: ${successfulDispatches}`);
    console.log(`Failed dispatches: ${failedDispatches}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'In-app call scheduling completed',
      queued: queuedCount,
      dispatched: successfulDispatches,
      failed: failedDispatches,
      total_due_schedules: dueSchedules.length
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