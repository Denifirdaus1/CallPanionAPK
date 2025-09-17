import React, { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface PushNotificationHandlerProps {
  onIncomingCall?: (callData: any) => void;
  onCallScheduled?: (callData: any) => void;
}

const PushNotificationHandler: React.FC<PushNotificationHandlerProps> = ({
  onIncomingCall,
  onCallScheduled
}) => {
  const { toast } = useToast();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotifications();
    
    // Listen for push notification events
    setupPushNotificationListeners();
    
    return () => {
      // Cleanup listeners
      removePushNotificationListeners();
    };
  }, []);

  const registerForPushNotifications = async () => {
    try {
      // Check if we're in a Capacitor environment
      if ((window as any).Capacitor?.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        // Request permission
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        
        if (permStatus.receive !== 'granted') {
          console.warn('Push notification permission not granted');
          return;
        }
        
        // Register for push notifications
        await PushNotifications.register();
        
        console.log('Successfully registered for push notifications');
      } else {
        // Web push notifications
        await registerWebPushNotifications();
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  const registerWebPushNotifications = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Web push notification permission not granted');
          return;
        }
        
        console.log('Web push notifications registered');
      } catch (error) {
        console.error('Error registering web push notifications:', error);
      }
    }
  };

  const setupPushNotificationListeners = async () => {
    try {
      if ((window as any).Capacitor?.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        // Handle registration
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
          storePushToken(token.value);
        });
        
        // Handle registration error
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });
        
        // Handle push notification received
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ', notification);
          handlePushNotification(notification);
        });
        
        // Handle notification action (when user taps notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed: ', notification);
          handleNotificationAction(notification);
        });
      } else {
        // Web push notification listeners
        navigator.serviceWorker?.addEventListener('message', (event) => {
          if (event.data?.type === 'push-notification') {
            handlePushNotification(event.data.notification);
          }
        });
      }
    } catch (error) {
      console.error('Error setting up push notification listeners:', error);
    }
  };

  const removePushNotificationListeners = async () => {
    try {
      if ((window as any).Capacitor?.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.removeAllListeners();
      }
    } catch (error) {
      console.error('Error removing push notification listeners:', error);
    }
  };

  const storePushToken = async (token: string) => {
    try {
      // Store the push token in local storage and send to server
      localStorage.setItem('push_token', token);
      
      // Send token to server to associate with user/device
      // This would typically be done via an API call to your backend
      console.log('Push token stored:', token);
    } catch (error) {
      console.error('Error storing push token:', error);
    }
  };

  const handlePushNotification = (notification: any) => {
    const { title, body, data } = notification;
    
    // Handle different types of notifications
    switch (data?.type) {
      case 'incoming_call':
        toast({
          title: title || 'Incoming Call',
          description: body || 'You have an incoming call from your family',
        });
        
        if (onIncomingCall) {
          onIncomingCall({
            sessionId: data.sessionId,
            relativeName: data.relativeName,
            callType: data.callType,
            householdId: data.householdId,
            relativeId: data.relativeId
          });
        }
        break;
        
      case 'call_scheduled':
        toast({
          title: title || 'Call Scheduled',
          description: body || 'A call has been scheduled',
        });
        
        if (onCallScheduled) {
          onCallScheduled(data);
        }
        break;
        
      case 'call_missed':
        toast({
          title: title || 'Missed Call',
          description: body || 'You missed a call from your family',
          variant: 'destructive'
        });
        break;
        
      default:
        // Generic notification
        toast({
          title: title || 'CallPanion',
          description: body || 'You have a new notification',
        });
        break;
    }
  };

  const handleNotificationAction = (notification: any) => {
    const { data } = notification.notification;
    
    // Handle when user taps on notification
    switch (data?.type) {
      case 'incoming_call':
        // Navigate to call interface or trigger call acceptance
        if (onIncomingCall) {
          onIncomingCall({
            sessionId: data.sessionId,
            relativeName: data.relativeName,
            callType: data.callType,
            householdId: data.householdId,
            relativeId: data.relativeId
          });
        }
        break;
        
      default:
        // Handle other notification actions
        console.log('Notification action performed:', notification);
        break;
    }
  };

  // This component doesn't render anything, it just handles push notifications
  return null;
};

export default PushNotificationHandler;