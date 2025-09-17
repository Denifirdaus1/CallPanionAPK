import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  PushNotifications, 
  PushNotificationSchema, 
  ActionPerformed,
  Token 
} from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useEnhancedPushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsSupported(true);
      // Don't auto-request permissions on startup
    } else if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      // Don't auto-request permissions on startup
    }
  }, [user]);

  const initializePushNotifications = async () => {
    if (!isSupported) return;
    
    try {
      await requestPushPermissions();
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  };

  const requestPushPermissions = async () => {
    try {
      // Request permission with user context
      const permission = await PushNotifications.requestPermissions();
      
      if (permission.receive === 'granted') {
        // Register with Apple/Google
        await PushNotifications.register();

        // Listen for registration token
        PushNotifications.addListener('registration', async (token: Token) => {
          // SECURITY FIX: Remove token logging to prevent credential exposure
          setToken(token.value);
          await savePushToken(token.value, Capacitor.getPlatform());
        });

        // Listen for push notifications
        PushNotifications.addListener('pushNotificationReceived', 
          (notification: PushNotificationSchema) => {
            console.log('Push notification received:', notification);
            
            // Show local toast for received notifications
            toast.info(notification.title || 'New notification', {
              description: notification.body
            });
          }
        );

        // Listen for notification actions
        PushNotifications.addListener('pushNotificationActionPerformed',
          (notification: ActionPerformed) => {
            console.log('Push notification action performed:', notification);
            
            // Handle notification tap - could navigate to specific screen
            const data = notification.notification.data;
            if (data?.type === 'media_upload') {
              // Navigate to family photos
              window.location.href = '/family/memories';
            } else if (data?.type === 'alert_rule') {
              // Navigate to alerts
              window.location.href = '/family/alerts';
            }
          }
        );

        setIsRegistered(true);
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  };

  const initializeWebPush = async () => {
    try {
      // For web push notifications (PWA)
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.pushManager) {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY' // TODO: Add VAPID key
        });
        
        const token = JSON.stringify(subscription);
        setToken(token);
        await savePushToken(token, 'web');
        setIsRegistered(true);
      }
    } catch (error) {
      console.error('Error initializing web push:', error);
    }
  };

  const savePushToken = async (tokenValue: string, platform: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          user_id: user.id,
          token: tokenValue,
          platform,
          device_info: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
          },
          is_active: true
        }, {
          onConflict: 'user_id,token'
        });

      if (error) {
        console.error('Error saving push token:', error);
      } else {
        console.log('Push token saved successfully');
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  };

  const sendTestNotification = async () => {
    if (!user) {
      toast.error('Please log in to send test notification');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_ids: [user.id],
          title: 'Test Notification',
          body: 'This is a test notification from CallPanion!',
          data: {
            type: 'test'
          }
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Test notification sent!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  const sendFamilyAlert = async (householdId: string, message: string, title?: string) => {
    if (!user) {
      toast.error('Please log in to send alerts');
      return;
    }

    try {
      // Get household members
      const { data: members, error: membersError } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId);

      if (membersError) throw membersError;

      const userIds = members?.map(m => m.user_id).filter(id => id !== user.id) || [];

      if (userIds.length === 0) {
        toast.info('No other family members to notify');
        return;
      }

      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_ids: userIds,
          title: title || 'Family Alert',
          body: message,
          data: {
            type: 'family_alert',
            household_id: householdId
          }
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Family alert sent!');
    } catch (error) {
      console.error('Error sending family alert:', error);
      toast.error('Failed to send family alert');
    }
  };

  return {
    isSupported,
    isRegistered,
    token,
    initializePushNotifications,
    sendTestNotification,
    sendFamilyAlert
  };
};