import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

export const useMobileCapabilities = () => {
  const [isNativeMobile, setIsNativeMobile] = useState(false);

  useEffect(() => {
    setIsNativeMobile(Capacitor.isNativePlatform());
    
    // Set status bar style for mobile
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light });
    }
  }, []);

  const takeFamilyPhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Camera not available on web platform');
    }

    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90,
        width: 1024,
        height: 1024
      });

      return photo;
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    }
  };

  const triggerHapticFeedback = async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (error) {
        console.error('Haptic feedback not available:', error);
      }
    }
  };

  const setStatusBarTheme = async (isDark: boolean) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.setStyle({ 
          style: isDark ? Style.Dark : Style.Light 
        });
      } catch (error) {
        console.error('Status bar customization not available:', error);
      }
    }
  };

  return {
    isNativeMobile,
    takeFamilyPhoto,
    triggerHapticFeedback,
    setStatusBarTheme
  };
};