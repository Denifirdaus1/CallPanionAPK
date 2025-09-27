# 📱 INTEGRATION GUIDE - SISTEM IN-APP CALL CALLPANION

## 📋 OVERVIEW ARSITEKTUR

Sistem in-app call CallPanion menggunakan arsitektur hybrid dengan komponen berikut:

1. **Flutter APK** - UI dan business logic
2. **Native Bridge** - Kotlin (Android) & Swift (iOS) untuk ElevenLabs SDK
3. **Edge Functions** - Backend logic di Supabase
4. **ElevenLabs Conversational AI** - Voice AI agent
5. **Push Notifications** - FCM (Android) & VoIP (iOS)

## 🔧 SETUP DEPENDENCIES

### **1. Android Setup (build.gradle)**

```gradle
// android/app/build.gradle
dependencies {
    // ElevenLabs Android SDK
    implementation 'io.elevenlabs:android-sdk:1.0.0'
    
    // Required dependencies
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.1'
    implementation 'com.squareup.okhttp3:okhttp:4.11.0'
    
    // Audio processing
    implementation 'com.twilio:audioswitch:1.1.8'
}
```

### **2. iOS Setup (Podfile)**

```ruby
# ios/Podfile
platform :ios, '14.0'

target 'Runner' do
  use_frameworks!
  
  # ElevenLabs iOS SDK
  pod 'ElevenLabs', '~> 1.0.0'
  
  # CallKit for VoIP
  pod 'CallKit'
  
  flutter_install_all_ios_pods File.dirname(File.realpath(__FILE__))
end
```

### **3. Flutter Dependencies (pubspec.yaml)**

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Core dependencies
  http: ^1.1.0
  shared_preferences: ^2.2.0
  permission_handler: ^11.0.1
  
  # Push notifications
  firebase_messaging: ^14.7.6
  flutter_callkit_incoming: ^2.0.4
  
  # Real-time updates
  supabase_flutter: ^2.0.0
```

## 🚀 IMPLEMENTASI STEP-BY-STEP

### **STEP 1: Device Pairing**

#### Web Dashboard (Keluarga)
```typescript
// Generate 6-digit pairing code
const generatePairingCode = async () => {
  const { data, error } = await supabase.functions.invoke('pair-init', {
    body: {
      household_id: currentHouseholdId,
      relative_id: selectedRelativeId
    }
  });
  
  if (data?.pairing_token) {
    // Display code to user
    setPairingCode(data.pairing_token);
  }
};
```

#### Flutter APK (Orangtua)
```dart
// Input pairing code
Future<void> claimPairingCode(String code) async {
  final response = await http.post(
    Uri.parse('${AppConstants.supabaseUrl}/functions/v1/pair-claim'),
    headers: {
      'Content-Type': 'application/json',
      'apikey': AppConstants.supabaseAnonKey,
    },
    body: json.encode({
      'pairingToken': code,
      'deviceInfo': {
        'platform': Platform.isIOS ? 'ios' : 'android',
        'fcm_token': await _getFCMToken(),
        'voip_token': Platform.isIOS ? await _getVoIPToken() : null,
      }
    }),
  );
  
  if (response.statusCode == 200) {
    // Save pairing info
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.keyPairingToken, code);
    // Navigate to main screen
  }
}
```

### **STEP 2: Schedule Call (Web Dashboard)**

```typescript
// Create call schedule
const createSchedule = async (schedule: ScheduleData) => {
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      household_id: householdId,
      relative_id: relativeId,
      morning_time: schedule.morningTime,
      afternoon_time: schedule.afternoonTime,
      evening_time: schedule.eveningTime,
      timezone: schedule.timezone,
      call_type: 'in_app_call',
      active: true
    });
};
```

### **STEP 3: Notification System (5 Menit Queueing)**

#### Scheduler Edge Function (Berjalan Setiap Menit)
```typescript
// Phase 1: Queue notifications 5 minutes before
const queueNotifications = async () => {
  const schedulesToQueue = await supabase.rpc('rpc_find_schedules_to_queue');
  
  for (const schedule of schedulesToQueue) {
    // Get device info from pairing
    const deviceInfo = await getDeviceInfo(schedule.relative_id);
    
    // Queue notification
    await supabase.from('notification_queue').insert({
      household_id: schedule.household_id,
      relative_id: schedule.relative_id,
      scheduled_time: schedule.scheduled_time,
      platform: deviceInfo.platform,
      device_token: deviceInfo.fcm_token,
      voip_token: deviceInfo.voip_token,
      status: 'queued'
    });
  }
};

// Phase 2: Send notifications at scheduled time
const executeNotifications = async () => {
  const readyNotifications = await supabase.rpc('rpc_find_ready_notifications');
  
  for (const notification of readyNotifications) {
    if (notification.platform === 'ios' && notification.voip_token) {
      // Send VoIP notification for iOS
      await supabase.functions.invoke('send-apns-voip-notification', {
        body: {
          voipToken: notification.voip_token,
          title: 'Incoming Call',
          body: 'Your family is calling',
          data: { sessionId, relativeName }
        }
      });
    } else {
      // Send FCM for Android
      await supabase.functions.invoke('send-fcm-notification', {
        body: {
          deviceToken: notification.device_token,
          title: 'Time for Your Call',
          body: 'Tap to answer',
          data: { sessionId, relativeName }
        }
      });
    }
  }
};
```

### **STEP 4: Handle Incoming Call (Flutter)**

```dart
// Setup notification handlers
Future<void> setupNotificationHandlers() async {
  // FCM for Android
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    if (message.data['type'] == 'incoming_call') {
      _showIncomingCall(message.data);
    }
  });
  
  // CallKit for iOS
  FlutterCallkitIncoming.onEvent.listen((event) {
    switch (event!.event) {
      case Event.actionCallAccept:
        _acceptCall(event.body);
        break;
      case Event.actionCallDecline:
        _declineCall(event.body);
        break;
    }
  });
}

// Show incoming call UI
Future<void> _showIncomingCall(Map<String, dynamic> data) async {
  final params = CallKitParams(
    id: data['sessionId'],
    nameCaller: data['relativeName'],
    appName: 'CallPanion',
    avatar: 'https://example.com/avatar.png',
    handle: 'CallPanion AI',
    type: 0, // 0 for audio call
    duration: 30000, // 30 seconds ring
    textAccept: 'Accept',
    textDecline: 'Decline',
    extra: data,
    android: AndroidParams(
      isCustomNotification: true,
      isShowLogo: true,
      ringtonePath: 'system_ringtone_default',
      backgroundColor: '#2563EB',
    ),
    ios: IOSParams(
      iconName: 'CallKitLogo',
      handleType: 'generic',
      supportsVideo: false,
      maximumCallGroups: 1,
      maximumCallsPerCallGroup: 1,
    ),
  );
  
  await FlutterCallkitIncoming.showCallkitIncoming(params);
}
```

### **STEP 5: Start ElevenLabs Conversation**

```dart
// When user accepts call
Future<void> _acceptCall(Map<String, dynamic> callData) async {
  final sessionId = callData['sessionId'];
  
  // Request conversation token from edge function
  final response = await http.post(
    Uri.parse('${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
    headers: {
      'Content-Type': 'application/json',
      'apikey': AppConstants.supabaseAnonKey,
    },
    body: json.encode({
      'sessionId': sessionId,
      'action': 'start',
      'pairingToken': _pairingToken,
      'deviceToken': _deviceToken,
    }),
  );
  
  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    
    // Start conversation via native bridge
    final conversationId = await _startNativeConversation(
      conversationToken: data['conversationToken'],
      dynamicVariables: {
        'session_id': sessionId,
        'household_id': data['householdId'],
        'relative_id': data['relativeId'],
      }
    );
    
    // Navigate to call screen
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CallScreen(
          sessionId: sessionId,
          conversationId: conversationId,
          relativeName: data['relativeName'],
        ),
      ),
    );
  }
}

// Start conversation via native SDK
Future<String> _startNativeConversation({
  required String conversationToken,
  required Map<String, String> dynamicVariables,
}) async {
  const platform = MethodChannel('com.yourapp.elevenlabs/conversation');
  
  try {
    final conversationId = await platform.invokeMethod('startConversation', {
      'conversationToken': conversationToken,
      'dynamicVariables': dynamicVariables,
    });
    
    return conversationId;
  } catch (e) {
    throw Exception('Failed to start conversation: $e');
  }
}
```

### **STEP 6: Handle Post-Call Webhook**

```typescript
// elevenlabs-webhook edge function
export async function handleWebhook(req: Request) {
  const body = await req.json();
  
  // Verify webhook signature
  const signature = req.headers.get('x-elevenlabs-signature');
  if (!verifySignature(body, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Extract call data
  const {
    conversation_id,
    metadata,
    transcript,
    summary,
    duration,
    sentiment_analysis
  } = body;
  
  // Update call log
  await supabase.from('call_logs').update({
    conversation_id: conversation_id,
    transcript: transcript,
    conversation_summary: summary,
    duration: duration,
    sentiment: sentiment_analysis,
    call_outcome: 'completed',
  }).eq('session_id', metadata.session_id);
  
  // Create call summary for dashboard
  await supabase.from('call_summaries').insert({
    household_id: metadata.household_id,
    relative_id: metadata.relative_id,
    call_log_id: metadata.call_log_id,
    summary: summary,
    mood_assessment: sentiment_analysis.mood,
    key_topics: sentiment_analysis.topics,
    health_indicators: extractHealthIndicators(transcript),
  });
  
  // Notify family members
  await notifyFamilyMembers(metadata.household_id, {
    type: 'call_completed',
    relative_name: metadata.relative_name,
    summary: summary,
  });
}
```

## 🧪 TESTING PROCEDURES

### **1. Test Device Pairing**
```bash
# Generate pairing code
curl -X POST "https://[project].supabase.co/functions/v1/pair-init" \
  -H "apikey: [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"household_id": "...", "relative_id": "..."}'

# Claim pairing code
curl -X POST "https://[project].supabase.co/functions/v1/pair-claim" \
  -H "apikey: [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"pairingToken": "123456", "deviceInfo": {...}}'
```

### **2. Test Notification System**
```sql
-- Check notification queue
SELECT * FROM notification_queue 
WHERE status = 'queued' 
ORDER BY scheduled_time;

-- Monitor scheduler execution
SELECT * FROM cron_heartbeat 
WHERE job_name = 'callpanion-in-app-calls' 
ORDER BY executed_at DESC LIMIT 10;
```

### **3. Test ElevenLabs Integration**
```dart
// Flutter test
testWidgets('ElevenLabs conversation starts correctly', (tester) async {
  final service = ElevenLabsCallService.instance;
  
  // Mock conversation token
  when(mockHttp.post(any, any)).thenAnswer((_) async => 
    Response('{"conversationToken": "test_token"}', 200));
  
  // Start call
  final result = await service.startElevenLabsCall('test_session');
  
  expect(result, isNotNull);
  expect(result['conversationToken'], equals('test_token'));
});
```

## 📊 MONITORING & DEBUGGING

### **Real-time Monitoring (Dashboard)**
```typescript
// Subscribe to real-time updates
const subscribeToCallUpdates = () => {
  const channel = supabase
    .channel(`household:${householdId}`)
    .on('broadcast', { event: 'call_started' }, (payload) => {
      console.log('Call started:', payload);
      updateCallStatus(payload.session_id, 'active');
    })
    .on('broadcast', { event: 'call_ended' }, (payload) => {
      console.log('Call ended:', payload);
      updateCallStatus(payload.session_id, 'completed');
      fetchCallSummary(payload.session_id);
    })
    .subscribe();
};
```

### **Debug Logs**
```dart
// Enable debug logging
class DebugLogger {
  static void log(String component, String message, [dynamic data]) {
    if (kDebugMode) {
      print('[$component] $message');
      if (data != null) {
        print('  Data: ${json.encode(data)}');
      }
    }
  }
}

// Usage
DebugLogger.log('ElevenLabs', 'Starting conversation', {
  'sessionId': sessionId,
  'hasToken': token != null,
});
```

## ⚠️ TROUBLESHOOTING

### **Common Issues & Solutions**

1. **Notification tidak diterima**
   - Check FCM/VoIP token registration
   - Verify device_pairs table has correct tokens
   - Check notification_queue status

2. **ElevenLabs conversation gagal start**
   - Verify ELEVENLABS_API_KEY di edge function secrets
   - Check conversation token validity
   - Ensure audio permissions granted

3. **Audio tidak terdengar**
   - Check AudioManager/AVAudioSession configuration
   - Verify microphone permissions
   - Test dengan different audio output devices

4. **Webhook tidak diterima**
   - Verify webhook URL di ElevenLabs request
   - Check ELEVENLABS_WEBHOOK_SECRET
   - Monitor edge function logs

## 🔐 SECURITY CHECKLIST

- [x] Validate pairing tokens before accepting calls
- [x] Verify webhook signatures from ElevenLabs  
- [x] Use service role key only in edge functions
- [x] Implement rate limiting untuk API calls
- [x] Encrypt sensitive data in SharedPreferences/Keychain
- [x] Validate all user inputs
- [x] Use HTTPS for all API communications

## 📈 PERFORMANCE OPTIMIZATIONS

1. **Queue notifications 5 minutes early** - Ensures timely delivery
2. **Cache JWT tokens for VoIP** - Reduces API calls
3. **Use connection pooling** - For database queries
4. **Implement retry logic** - For failed notifications
5. **Lazy load call summaries** - Load on demand in dashboard

## 🎯 DEPLOYMENT CHECKLIST

### **Pre-Deployment**
- [ ] All edge functions deployed
- [ ] Database migrations applied
- [ ] Secrets configured in Supabase
- [ ] Firebase project setup complete
- [ ] Apple Push Notification certificates uploaded

### **Testing**
- [ ] Device pairing flow tested
- [ ] Notifications received on both platforms
- [ ] Call quality acceptable
- [ ] Webhook processing working
- [ ] Dashboard updates real-time

### **Production**
- [ ] APK signed with release keys
- [ ] iOS app provisioning profiles valid
- [ ] Edge functions have proper CORS
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented

## 📚 REFERENSI DOKUMENTASI

- [ElevenLabs Conversational AI](https://elevenlabs.io/docs/agents-platform/overview)
- [ElevenLabs Android SDK](https://elevenlabs.io/docs/agents-platform/libraries/kotlin)
- [ElevenLabs iOS SDK](https://elevenlabs.io/docs/agents-platform/libraries/swift)
- [WebRTC Token API](https://elevenlabs.io/docs/api-reference/conversations/get-webrtc-token)
- [Post-call Webhooks](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks)
- [Android ConnectionService](https://developer.android.com/reference/android/telecom/ConnectionService)
- [iOS CallKit](https://developer.apple.com/documentation/callkit/)
- [iOS PushKit](https://developer.apple.com/documentation/pushkit)

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Author**: CallPanion Development Team