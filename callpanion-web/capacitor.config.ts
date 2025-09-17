import type { CapacitorConfig } from '@capacitor/cli';

const isProduction = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: isProduction ? 'uk.co.callpanion.app' : 'app.lovable.a4b57244d3ad47ea85cac99941e17d30',
  appName: 'CallPanion',
  webDir: 'dist',
  ...(isProduction ? {} : {
    server: {
      url: 'https://a4b57244-d3ad-47ea-85ca-c99941e17d30.lovableproject.com?forceHideBadge=true',
      cleartext: true
    }
  }),
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#a85751'
    },
    Haptics: {
      // Enable all haptic patterns for elderly interface feedback
    },
    Keyboard: {
      resize: 'native'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#f7f5f4',
      showSpinner: true,
      spinnerColor: '#a85751'
    }
  }
};

export default config;