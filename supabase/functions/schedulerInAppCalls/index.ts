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

          // Create call log for in-app call
          const { data: callLog, error: logError } = await supabase
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

          // Get device pairing for this relative to determine platform and token
          const { data: devicePair, error: deviceError } = await supabase
            .from('device_pairs')
            .select('claimed_by, device_info')
            .eq('household_id', schedule.household_id)
            .eq('relative_id', schedule.relative_id)
            .not('claimed_at', 'is', null)
            .single();

          let elderlyDeviceToken = null;
          let voipToken = null;
          let platform = 'unknown';
          let tokenSource = 'none';

          if (!deviceError && devicePair && devicePair.claimed_by) {
            // Determine platform from device info
            platform = devicePair.device_info?.platform || 'unknown';

            // Get tokens based on platform
            if (platform === 'ios') {
              // For iOS, prefer VoIP token for incoming calls
              voipToken = devicePair.device_info?.voip_token;
              elderlyDeviceToken = devicePair.device_info?.fcm_token;
              tokenSource = 'device_pairs';

              console.log(`iOS device detected for relative ${schedule.relative_id}`);
              console.log(`VoIP token: ${voipToken ? 'available' : 'missing'}`);
              console.log(`FCM token: ${elderlyDeviceToken ? 'available' : 'missing'}`);

            } else if (platform === 'android') {
              // For Android, use FCM token
              elderlyDeviceToken = devicePair.device_info?.fcm_token;
              tokenSource = 'device_pairs';
              console.log(`Android device detected for relative ${schedule.relative_id}`);
            }

            // Fallback: get tokens from push_notification_tokens if not in device_info
            if (!elderlyDeviceToken && !voipToken) {
              const { data: fallbackTokens, error: fallbackError } = await supabase
                .from('push_notification_tokens')
                .select('token, platform, voip_token')
                .eq('user_id', devicePair.claimed_by)
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

              if (!fallbackError && fallbackTokens) {
                elderlyDeviceToken = fallbackTokens.token;
                voipToken = fallbackTokens.voip_token;
                platform = fallbackTokens.platform || platform;
                tokenSource = 'push_notification_tokens';
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
          scheduled_calls: successfulDispatches,
          failed_calls: failedDispatches,
          total_due_schedules: dueSchedules.length,
          in_app_schedules: inAppCallSchedules.length,
          missing_tokens: failedDispatches,
          timestamp: new Date().toISOString()
        }
      }, {
        onConflict: 'job_name'
      });

    console.log('=== schedulerInAppCalls completed ===');
    console.log(`Successful dispatches: ${successfulDispatches}`);
    console.log(`Failed dispatches: ${failedDispatches}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'In-app call scheduling completed',
      dispatched: successfulDispatches,
      failed: failedDispatches,
      total_due_schedules: dueSchedules.length,
      in_app_schedules: inAppCallSchedules.length
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