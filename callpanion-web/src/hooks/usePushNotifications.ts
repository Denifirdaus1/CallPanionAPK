import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  PushNotifications, 
  PushNotificationSchema, 
  ActionPerformed,
  Token 
} from '@capacitor/push-notifications';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsSupported(true);
      initializePushNotifications();
    }
  }, []);

  const initializePushNotifications = async () => {
    try {
      // Request permission
      const permission = await PushNotifications.requestPermissions();
      
      if (permission.receive === 'granted') {
        // Register with Apple/Google
        await PushNotifications.register();

        // Listen for registration token
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration success');
          setToken(token.value);
        });

        // Listen for push notifications
        PushNotifications.addListener('pushNotificationReceived', 
          (notification: PushNotificationSchema) => {
            console.log('Push notification received');
          }
        );

        // Listen for notification actions
        PushNotifications.addListener('pushNotificationActionPerformed',
          (notification: ActionPerformed) => {
            console.log('Push notification action performed');
          }
        );
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  };

  const sendFamilyAlert = async (message: string) => {
    // This would typically call your backend service
    console.log('Sending family alert');
    
    // For demo purposes, show a local notification
    if (isSupported) {
      // In a real app, this would be sent from your backend
      console.log('Family alert sent');
    }
  };

  return {
    isSupported,
    token,
    sendFamilyAlert
  };
};