import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===============================================
// ENHANCED IN-APP CALL NOTIFICATION SYSTEM
// ===============================================
// This scheduler implements a robust 2-phase system:
// Phase 1: QUEUEING - Queue notifications 5 minutes before execution
// Phase 2: EXECUTION - Send notifications at exact scheduled time
//
// Example: For schedule at 20:45
// - 20:40: Notification queued with device info
// - 20:45: Notification sent to device exactly on time

interface QueuedNotification {
  queue_id: string;
  household_id: string;
  relative_id: string;
  schedule_id: string;
  scheduled_time: string;
  slot_type: string;
  platform?: string;
  device_token?: string;
  voip_token?: string;
  retry_count: number;
}

interface ScheduleToQueue {
  schedule_id: string;
  household_id: string;
  relative_id: string;
  slot_type: string;
  scheduled_time: string;
  timezone: string;
}

// Enhanced retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000
};

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

      console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, (error as Error).message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Enhanced queueing function with device detection
async function queueNotificationWithDeviceInfo(
  supabase: any,
  schedule: ScheduleToQueue
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Queue] 📝 Processing schedule ${schedule.schedule_id} for relative ${schedule.relative_id}`);
    console.log(`[Queue] 🕐 Scheduled for: ${schedule.scheduled_time} (${schedule.slot_type})`);

    // Check if household prefers in-app calls
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('call_method_preference')
      .eq('id', schedule.household_id)
      .single();

    if (householdError) {
      throw new Error(`Failed to fetch household: ${householdError.message}`);
    }

    // Get device pairing info for this relative
    const { data: devicePair, error: deviceError } = await supabase
      .from('device_pairs')
      .select('claimed_by, device_info, created_at, claimed_at')
      .eq('household_id', schedule.household_id)
      .eq('relative_id', schedule.relative_id)
      .not('claimed_at', 'is', null)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .single();

    let platform = 'unknown';
    let deviceToken = null;
    let voipToken = null;
    let tokenSource = 'none';

    if (!deviceError && devicePair) {
      platform = devicePair.device_info?.platform || 'unknown';
      deviceToken = devicePair.device_info?.fcm_token;
      voipToken = devicePair.device_info?.voip_token;
      tokenSource = 'device_pairs';

      console.log(`[Queue] 📱 Device found: platform=${platform}`);
      console.log(`[Queue] 🔑 Tokens: FCM=${deviceToken ? '✓' : '✗'} VoIP=${voipToken ? '✓' : '✗'}`);

      // Fallback to push_notification_tokens if needed
      if (!deviceToken && !voipToken && devicePair.claimed_by) {
        console.log(`[Queue] 🔍 Checking fallback tokens for user ${devicePair.claimed_by}`);

        const { data: fallbackTokens } = await supabase
          .from('push_notification_tokens')
          .select('token, platform, voip_token')
          .eq('user_id', devicePair.claimed_by)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (fallbackTokens) {
          deviceToken = fallbackTokens.token;
          voipToken = fallbackTokens.voip_token;
          platform = fallbackTokens.platform || platform;
          tokenSource = 'push_notification_tokens';
          console.log(`[Queue] ✅ Using fallback tokens from push_notification_tokens`);
        }
      }
    } else {
      console.log(`[Queue] ⚠️ No device pairing found for relative ${schedule.relative_id}`);

      // Check if this household should still get in-app calls
      const includeSchedule =
        household.call_method_preference === 'in_app_call';

      if (!includeSchedule) {
        console.log(`[Queue] ⏭️ Skipping - household doesn't prefer in-app calls and no device paired`);
        return { success: true }; // Not an error, just skip
      }
    }

    // Only queue if we have at least one valid notification method or household prefers in-app
    const shouldQueue = (deviceToken || voipToken) || household.call_method_preference === 'in_app_call';

    if (!shouldQueue) {
      console.log(`[Queue] ⏭️ Skipping - no notification method available`);
      return { success: true };
    }

    // Queue the notification
    const { data: queuedNotification, error: queueError } = await supabase
      .from('notification_queue')
      .insert({
        household_id: schedule.household_id,
        relative_id: schedule.relative_id,
        schedule_id: schedule.schedule_id,
        scheduled_time: schedule.scheduled_time,
        queue_time: new Date().toISOString(),
        slot_type: schedule.slot_type,
        notification_type: 'in_app_call',
        platform: platform,
        device_token: deviceToken,
        voip_token: voipToken,
        status: 'queued'
      })
      .select()
      .single();

    if (queueError) {
      // Check if it's a duplicate (which is expected/OK)
      if (queueError.code === '23505') { // unique constraint violation
        console.log(`[Queue] ✓ Notification already queued for relative ${schedule.relative_id} at ${schedule.scheduled_time}`);
        return { success: true };
      }
      throw new Error(`Queue insertion failed: ${queueError.message}`);
    }

    console.log(`[Queue] ✅ Successfully queued notification ${queuedNotification.id}`);
    console.log(`[Queue] 📅 Execution scheduled for: ${schedule.scheduled_time}`);
    console.log(`[Queue] 🔧 Platform: ${platform}, Token source: ${tokenSource}`);

    return { success: true };

  } catch (error) {
    console.error(`[Queue] ❌ Failed to queue notification:`, (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// Temporary direct execution function (fallback)
async function executeScheduleDirectly(
  supabase: any,
  schedule: ScheduleToQueue
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Execute] 🚀 Direct execution for relative ${schedule.relative_id}`);

    // Get device pairing info
    const { data: devicePair, error: deviceError } = await supabase
      .from('device_pairs')
      .select('claimed_by, device_info, created_at, claimed_at')
      .eq('household_id', schedule.household_id)
      .eq('relative_id', schedule.relative_id)
      .not('claimed_at', 'is', null)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .single();

    let platform = 'unknown';
    let deviceToken = null;
    let voipToken = null;

    if (!deviceError && devicePair) {
      platform = devicePair.device_info?.platform || 'unknown';
      deviceToken = devicePair.device_info?.fcm_token;
      voipToken = devicePair.device_info?.voip_token;

      // Fallback to push_notification_tokens if needed
      if (!deviceToken && !voipToken && devicePair.claimed_by) {
        const { data: fallbackTokens } = await supabase
          .from('push_notification_tokens')
          .select('token, platform, voip_token')
          .eq('user_id', devicePair.claimed_by)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (fallbackTokens) {
          deviceToken = fallbackTokens.token;
          voipToken = fallbackTokens.voip_token;
          platform = fallbackTokens.platform || platform;
        }
      }
    }

    if (!deviceToken && !voipToken) {
      console.log(`[Execute] ⚠️ No notification tokens available for relative ${schedule.relative_id}`);
      return { success: true }; // Skip but don't fail
    }

    // Create call session
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .insert({
        household_id: schedule.household_id,
        relative_id: schedule.relative_id,
        status: 'scheduled',
        provider: 'webrtc',
        call_type: 'in_app_call',
        scheduled_time: schedule.scheduled_time,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Session creation failed: ${sessionError.message}`);
    }

    // Get relative info
    const { data: relative, error: relativeError } = await supabase
      .from('relatives')
      .select('first_name, last_name')
      .eq('id', schedule.relative_id)
      .single();

    if (relativeError || !relative) {
      throw new Error(`Failed to fetch relative info: ${relativeError?.message}`);
    }

    const relativeName = `${relative.first_name} ${relative.last_name}`;

    // Prepare notification data
    const isVoIP = platform === 'ios' && voipToken;
    const notificationData = {
      voipToken: voipToken,
      deviceToken: deviceToken,
      title: isVoIP ? 'Incoming Call' : 'Time for Your Call',
      body: isVoIP
        ? `${relative.first_name} is calling`
        : `Your family is ready to talk with you, ${relative.first_name}!`,
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
      callSessionId: session.id
    };

    // Send notification
    let result;
    if (isVoIP) {
      console.log(`[Execute] 📱 Sending APNS VoIP notification to iOS device`);
      result = await supabase.functions.invoke('send-apns-voip-notification', {
        body: notificationData
      });
    } else if (deviceToken) {
      console.log(`[Execute] 📱 Sending FCM notification to ${platform} device`);
      result = await supabase.functions.invoke('send-fcm-notification', {
        body: notificationData
      });
    } else {
      throw new Error('No suitable notification method available');
    }

    if (result.error) {
      throw new Error(`Notification failed: ${result.error.message || 'Unknown error'}`);
    }

    console.log(`[Execute] ✅ Notification sent successfully to relative ${schedule.relative_id}`);

    // Create call log
    await supabase
      .from('call_logs')
      .insert({
        user_id: schedule.relative_id,
        relative_id: schedule.relative_id,
        household_id: schedule.household_id,
        call_outcome: 'initiated',
        provider: 'webrtc',
        call_type: 'in_app_call',
        session_id: session.id,
        timestamp: schedule.scheduled_time
      });

    return { success: true };

  } catch (error) {
    console.error(`[Execute] ❌ Failed to execute schedule:`, (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// Enhanced notification sending with retry
async function executeQueuedNotification(
  supabase: any,
  notification: QueuedNotification
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Execute] 🚀 Processing notification ${notification.queue_id}`);
    console.log(`[Execute] 👤 Target: relative ${notification.relative_id} (${notification.platform})`);

    // Mark as processing
    await supabase
      .from('notification_queue')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.queue_id);

    // Create call session first
    const session = await createCallSession(supabase, notification);
    console.log(`[Execute] 📞 Created call session: ${session.id}`);

    // Get relative info for notification
    const { data: relative, error: relativeError } = await supabase
      .from('relatives')
      .select('first_name, last_name')
      .eq('id', notification.relative_id)
      .single();

    if (relativeError || !relative) {
      throw new Error(`Failed to fetch relative info: ${relativeError?.message}`);
    }

    const relativeName = `${relative.first_name} ${relative.last_name}`;

    // Check if we have notification tokens
    if (!notification.device_token && !notification.voip_token) {
      console.log(`[Execute] ⚠️ No notification tokens available for relative ${notification.relative_id}`);

      // Still create the session but don't fail - maybe family will call manually
      await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          processed_at: new Date().toISOString(),
          last_error: 'No notification tokens available'
        })
        .eq('id', notification.queue_id);

      return { success: true };
    }

    // Prepare notification data
    const isVoIP = notification.platform === 'ios' && notification.voip_token;
    const notificationData = {
      voipToken: notification.voip_token,
      deviceToken: notification.device_token,
      title: isVoIP ? 'Incoming Call' : 'Time for Your Call',
      body: isVoIP
        ? `${relative.first_name} is calling`
        : `Your family is ready to talk with you, ${relative.first_name}!`,
      data: {
        type: 'incoming_call',
        sessionId: session.id,
        relativeName: relativeName,
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
    };

    // Send platform-specific notification with retry
    const notificationResult = await retryOperation(async () => {
      let result;

      if (isVoIP) {
        console.log(`[Execute] 📱 Sending APNS VoIP notification to iOS device`);
        result = await supabase.functions.invoke('send-apns-voip-notification', {
          body: notificationData
        });
      } else if (notification.device_token) {
        console.log(`[Execute] 📱 Sending FCM notification to ${notification.platform} device`);
        result = await supabase.functions.invoke('send-fcm-notification', {
          body: notificationData
        });
      } else {
        throw new Error('No suitable notification method available');
      }

      if (result.error) {
        throw new Error(`Notification failed: ${result.error.message || 'Unknown error'}`);
      }

      return result;
    });

    console.log(`[Execute] ✅ Notification sent successfully to relative ${notification.relative_id}`);

    // Mark as sent
    await supabase
      .from('notification_queue')
      .update({
        status: 'sent',
        processed_at: new Date().toISOString()
      })
      .eq('id', notification.queue_id);

    // Create call log
    await createCallLog(supabase, notification, session);

    // Broadcast to dashboard
    await broadcastCallScheduled(supabase, notification.household_id, session, relativeName);

    // Notify family members
    await notifyFamilyMembers(supabase, notification.household_id, session.id, relativeName);

    return { success: true };

  } catch (error) {
    console.error(`[Execute] ❌ Failed to execute notification:`, (error as Error).message);

    // Update retry count and status
    const newRetryCount = notification.retry_count + 1;
    const status = newRetryCount >= 3 ? 'failed' : 'queued';

    await supabase
      .from('notification_queue')
      .update({
        status: status,
        retry_count: newRetryCount,
        last_error: (error as Error).message,
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.queue_id);

    return { success: false, error: (error as Error).message };
  }
}

// Helper functions
async function createCallSession(supabase: any, notification: QueuedNotification): Promise<any> {
  const { data: session, error: sessionError } = await supabase
    .from('call_sessions')
    .insert({
      household_id: notification.household_id,
      relative_id: notification.relative_id,
      status: 'scheduled',
      provider: 'webrtc',
      call_type: 'in_app_call',
      scheduled_time: notification.scheduled_time,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (sessionError) {
    throw new Error(`Session creation failed: ${sessionError.message}`);
  }

  return session;
}

async function createCallLog(supabase: any, notification: QueuedNotification, session: any): Promise<void> {
  await supabase
    .from('call_logs')
    .insert({
      user_id: notification.relative_id,
      relative_id: notification.relative_id,
      household_id: notification.household_id,
      call_outcome: 'initiated',
      provider: 'webrtc',
      call_type: 'in_app_call',
      session_id: session.id,
      timestamp: notification.scheduled_time
    });
}

async function broadcastCallScheduled(supabase: any, householdId: string, session: any, relativeName: string): Promise<void> {
  try {
    const channel = supabase.channel(`household:${householdId}`);
    await channel.send({
      type: 'broadcast',
      event: 'call_scheduled',
      payload: {
        session_id: session.id,
        relative_id: session.relative_id,
        relative_name: relativeName,
        household_id: householdId,
        call_type: 'in_app_call',
        status: 'scheduled',
        scheduled_time: session.scheduled_time,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.warn('[Execute] Failed to broadcast call scheduled event:', (error as Error).message);
  }
}

async function notifyFamilyMembers(supabase: any, householdId: string, sessionId: string, relativeName: string): Promise<void> {
  try {
    const { data: familyMembers } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId);

    if (familyMembers) {
      for (const member of familyMembers) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: member.user_id,
              title: 'Call Scheduled',
              body: `Scheduled call sent to ${relativeName}`,
              data: {
                type: 'call_scheduled',
                sessionId: sessionId,
                relativeName: relativeName,
                householdId: householdId
              }
            }
          });
        } catch (error) {
          console.warn('[Execute] Family notification failed:', (error as Error).message);
        }
      }
    }
  } catch (error) {
    console.warn('[Execute] Failed to notify family members:', (error as Error).message);
  }
}

// Main scheduler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('\n=== 🚀 Enhanced schedulerInAppCalls triggered ===');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🔧 Method:', req.method);

    const supabase = serviceClient();
    let queuedCount = 0;
    let executedCount = 0;
    let errors: string[] = [];

    // ========================================
    // PHASE 1: QUEUEING (5 minutes before)
    // ========================================
    console.log('\n[Phase 1] 🔍 Checking for schedules to queue (5 min before execution)...');

    const { data: allSchedules, error: queueError } = await supabase
      .rpc('rpc_find_schedules_to_queue');

    if (queueError) {
      console.error('[Phase 1] Error fetching schedules to queue:', queueError);
      throw queueError;
    }

    // ⚠️ FIX: Deduplicate schedules - only keep latest per relative
    let schedulesToQueue: any[] = [];
    if (allSchedules && allSchedules.length > 0) {
      const uniqueMap = new Map();
      allSchedules.forEach((schedule: any) => {
        const existing = uniqueMap.get(schedule.relative_id);
        if (!existing || new Date(schedule.scheduled_time) > new Date(existing.scheduled_time)) {
          uniqueMap.set(schedule.relative_id, schedule);
        }
      });
      schedulesToQueue = Array.from(uniqueMap.values());
      console.log(`[Phase 1] Found ${allSchedules.length} schedules, deduplicated to ${schedulesToQueue.length} unique relatives`);
    } else {
      console.log(`[Phase 1] Found 0 schedules to queue`);
    }

    if (schedulesToQueue.length > 0) {
      for (const schedule of schedulesToQueue) {
        const result = await queueNotificationWithDeviceInfo(supabase, schedule);
        if (result.success) {
          queuedCount++;
        } else {
          errors.push(`Queue failed for ${schedule.relative_id}: ${result.error}`);
        }
      }
    }

    // ========================================
    // PHASE 2: EXECUTION (at scheduled time)
    // ========================================
    console.log('\n[Phase 2] ⚡ Checking for ready notifications to execute...');

    const { data: allNotifications, error: readyError } = await supabase
      .rpc('rpc_find_ready_notifications');

    if (readyError) {
      console.error('[Phase 2] Error fetching ready notifications:', readyError);
      throw readyError;
    }

    // ⚠️ FIX: Deduplicate notifications - only execute latest per relative
    let readyNotifications: any[] = [];
    if (allNotifications && allNotifications.length > 0) {
      const uniqueMap = new Map();
      allNotifications.forEach((notif: any) => {
        const existing = uniqueMap.get(notif.relative_id);
        if (!existing || new Date(notif.scheduled_time) > new Date(existing.scheduled_time)) {
          uniqueMap.set(notif.relative_id, notif);
        }
      });
      readyNotifications = Array.from(uniqueMap.values());
      console.log(`[Phase 2] Found ${allNotifications.length} notifications, deduplicated to ${readyNotifications.length} unique relatives`);
    } else {
      console.log(`[Phase 2] Found 0 ready notifications`);
    }

    if (readyNotifications.length > 0) {
      for (const notification of readyNotifications) {
        const result = await executeQueuedNotification(supabase, notification);
        if (result.success) {
          executedCount++;
        } else {
          errors.push(`Execute failed for ${notification.relative_id}: ${result.error}`);
        }
      }
    }

    // ========================================
    // PHASE 3: CLEANUP
    // ========================================
    console.log('\n[Phase 3] 🧹 Cleaning up expired notifications...');

    const { data: cleanupResult } = await supabase
      .rpc('cleanup_notification_queue');

    const cleanedCount = cleanupResult || 0;
    if (cleanedCount > 0) {
      console.log(`[Phase 3] Cleaned up ${cleanedCount} expired notifications`);
    }

    // ========================================
    // HEARTBEAT & SUMMARY
    // ========================================
    const status = errors.length === 0 ? 'success' : 'partial_success';

    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'callpanion-in-app-calls',
        last_run: new Date().toISOString(),
        status: status,
        details: {
          summary: {
            queued_notifications: queuedCount,
            executed_notifications: executedCount,
            total_errors: errors.length,
            cleaned_notifications: cleanedCount
          },
          errors: errors.slice(0, 10), // Keep last 10 errors
          timestamp: new Date().toISOString(),
          environment: {
            function_version: '3.0.0-enhanced',
            features: ['5min_queueing', 'retry_mechanism', 'device_detection', 'real_time_broadcasting']
          }
        }
      }, {
        onConflict: 'job_name'
      });

    console.log('\n=== 📊 Scheduler Summary ===');
    console.log(`✅ Queued: ${queuedCount} notifications`);
    console.log(`🚀 Executed: ${executedCount} notifications`);
    console.log(`🧹 Cleaned: ${cleanedCount} expired notifications`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log('=== End Summary ===\n');

    return new Response(JSON.stringify({
      success: true,
      message: 'Enhanced in-app call scheduling completed',
      summary: {
        queued: queuedCount,
        executed: executedCount,
        cleaned: cleanedCount,
        errors: errors.length,
        success_rate: executedCount + queuedCount > 0 ?
          Math.round(((executedCount + queuedCount - errors.length) / (executedCount + queuedCount)) * 100) : 100
      },
      errors: errors,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Critical error in schedulerInAppCalls:', error);

    // Log error to heartbeat
    const supabase = serviceClient();
    await supabase
      .from('cron_heartbeat')
      .upsert({
        job_name: 'callpanion-in-app-calls',
        last_run: new Date().toISOString(),
        status: 'error',
        details: {
          error: (error as Error).message,
          stack: (error as Error).stack,
          timestamp: new Date().toISOString()
        }
      }, {
        onConflict: 'job_name'
      });

    return new Response(JSON.stringify({
      error: 'in_app_call_scheduling_failed',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});