ANALISIS FILE YANG BERHUBUNGAN DENGAN FCM NOTIFICATIONS ANDROID:
🔍 FILE-FILE FCM NOTIFICATIONS ANDROID:
1. lib/services/fcm_service.dart - FILE UTAMA FCM
Fungsi: Service utama untuk FCM notifications

class FCMService {
  // ✅ Initialize FCM service
  Future<void> initialize() async

  // ✅ Register FCM token ke server
  Future<bool> registerToken() async

  // ✅ Handle incoming FCM messages
  void _setupFCMListeners() async

  // ✅ Handle background messages
  static Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async
}

2. android/app/src/main/AndroidManifest.xml - ANDROID CONFIGURATION
Fungsi: Konfigurasi FCM di Android
<!-- ✅ FCM permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- ✅ FCM service -->
<service
    android:name="io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

3. android/app/google-services.json - FIREBASE CONFIGURATION
Fungsi: Konfigurasi Firebase untuk FCM

{
  "project_info": {
    "project_number": "...",
    "project_id": "...",
    "storage_bucket": "..."
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "...",
        "android_client_info": {
          "package_name": "app.lovable.a4b57244d3ad47ea85cac99941e17d30"
        }
      },
      "oauth_client": [...],
      "api_key": [...],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [...]
        }
      }
    }
  ],
  "configuration_version": "1"
}

4. android/app/build.gradle - FCM DEPENDENCIES
Fungsi: Dependencies untuk FCM

// ✅ Firebase Messaging
implementation 'com.google.firebase:firebase-messaging:23.2.1'

// ✅ Google Services plugin
plugins {
    id 'com.google.gms.google-services'
}

5. android/build.gradle - GOOGLE SERVICES PLUGIN
Fungsi: Google Services plugin untuk FCM

// ✅ Google Services classpath
dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
}

6. lib/services/api_service.dart - FCM TOKEN REGISTRATION
Fungsi: Register FCM token ke server

// ✅ Register FCM token
Future<bool> registerFCMToken({
  String? fcmToken,
  String? voipToken,
}) async {
  // ... FCM token registration logic
}

7. lib/services/callkit_service.dart - FCM INTEGRATION
Fungsi: Integrasi FCM dengan CallKit

// ✅ FCM callbacks
FCMService.instance.onIncomingCall = (callData) {
  setState(() {
    _currentCall = callData;
    _status = 'Incoming call from ${callData.relativeName}';
  });
  // Navigate immediately to call screen for incoming calls
  if (mounted) {
    _navigateToCallScreen(callData.sessionId, callData.callType);
  }
};

8. lib/main.dart - FCM INITIALIZATION
Fungsi: Initialize FCM service
// ✅ Initialize FCM service
await FCMService.instance.initialize();

9. lib/screens/main_screen.dart - FCM CALLBACKS
Fungsi: Setup FCM callbacks

// ✅ Setup FCM callbacks
void _setupFCMCallbacks() {
  FCMService.instance.onIncomingCall = (callData) {
    setState(() {
      _currentCall = callData;
      _status = 'Incoming call from ${callData.relativeName}';
    });
    // Navigate immediately to call screen for incoming calls
    if (mounted) {
      _navigateToCallScreen(callData.sessionId, callData.callType);
    }
  };

  FCMService.instance.onCallScheduled = (data) {
    setState(() {
      _status = 'Call scheduled with your family';
    });
  };
}

10. lib/screens/pairing_screen.dart - FCM RE-REGISTRATION
Fungsi: Re-register FCM token setelah pairing

// ✅ Re-register FCM token after pairing
try {
  final fcmSuccess = await FCMService.instance.registerToken();
  if (kDebugMode) {
    print('📱 FCM token re-registered after pairing: $fcmSuccess');
  }
} catch (e) {
  if (kDebugMode) {
    print('❌ Error re-registering FCM token after pairing: $e');
  }
}

11. lib/utils/constants.dart - FCM CONFIGURATION
Fungsi: Constants untuk FCM

// ✅ Supabase configuration untuk FCM
static const String supabaseUrl = 'https://a4b57244d3ad47ea85cac99941e17d30.supabase.co';
static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// ✅ API endpoints untuk FCM
static const String registerFcmTokenUrl = '$supabaseUrl/functions/v1/register-fcm-token';

12. supabase/functions/send-fcm-notification/index.ts - FCM EDGE FUNCTION
Fungsi: Edge Function untuk send FCM notifications

// ✅ FCM v1 API implementation
const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

// ✅ OAuth authentication
const accessToken = await getAccessToken();

// ✅ Send FCM notification
const response = await fetch(fcmUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(message)
});

📊 FLOW FCM NOTIFICATIONS ANDROID:
1. FCM Setup Flow:
App Start → FCMService.initialize() → Firebase.initializeApp

2. FCM Registration Flow:
FCM Token Generated → FCMService.registerToken() → ApiService.registerFCMToken() → Server

3. FCM Notification Flow:
Server → send-fcm-notification Edge Function → FCM API → Android Device → FCMService → CallKit

4. FCM Call Handling Flow:
FCM Message Received → FCMService.onIncomingCall → CallKitService.showIncomingCall() → User Accept → ElevenLabs Call

🎯 KESIMPULAN:
File-file FCM Notifications Android:
lib/services/fcm_service.dart - Service utama FCM
android/app/src/main/AndroidManifest.xml - Android configuration
android/app/google-services.json - Firebase configuration
android/app/build.gradle - FCM dependencies
android/build.gradle - Google Services plugin
lib/services/api_service.dart - FCM token registration
lib/services/callkit_service.dart - FCM integration
lib/main.dart - FCM initialization
lib/screens/main_screen.dart - FCM callbacks
lib/screens/pairing_screen.dart - FCM re-registration
lib/utils/constants.dart - FCM configuration
supabase/functions/send-fcm-notification/index.ts - FCM Edge Function
Semua file ini bekerja sama untuk FCM notifications Android! 🚀