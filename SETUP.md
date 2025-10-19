# CallPanion Elderly App - Setup Instructions

## 📱 Flutter Project Setup

### 1. Create New Flutter Project
```bash
flutter create callpanion_elderly
cd callpanion_elderly
```

### 2. Replace pubspec.yaml
Copy the `pubspec.yaml` content provided and run:
```bash
flutter pub get
```

### 3. Generate Model Files
Run the code generation:
```bash
flutter packages pub run build_runner build
```

### 4. Platform Configuration

#### Android Setup
1. Update `android/app/src/main/AndroidManifest.xml` with permissions
2. Add proguard rules in `android/app/proguard-rules.pro`:
```
-keep class com.hiennv.flutter_callkit_incoming.** { *; }
```

#### iOS Setup
1. Update `ios/Runner/Info.plist` with background modes
2. Add CallKit logo to `ios/Runner/Assets.xcassets/CallKitLogo.imageset/`

### 5. Firebase Setup

#### Android Firebase
1. Add `google-services.json` to `android/app/`
2. Update `android/build.gradle` and `android/app/build.gradle`

#### iOS Firebase  
1. Add `GoogleService-Info.plist` to `ios/Runner/`
2. Update `ios/Runner.xcworkspace` in Xcode

### 6. Copy Source Files
Copy all files from the `lib/` directory structure provided.

## 🔧 Backend Integration

The app integrates with these CallPanion Edge Functions:

### Core Functions
- `register-fcm-token` - Register FCM and VoIP tokens
- `pair-claim` - Claim device pairing with 6-digit code
- `claim-chat-access` - Authenticate for chat access

### Notification Functions
- `send-fcm-notification` - Send FCM notifications to Android
- `send-push-notification` - Send notifications to multiple users
- `send-apns-voip-notification` - Send VoIP notifications to iOS
- `schedulerInAppCalls` - Enhanced 2-phase notification scheduling

### ElevenLabs Integration
- `elevenlabs-device-call` - Manage ElevenLabs call lifecycle
- `elevenlabs-webhook` - Process post-call data from ElevenLabs

## 📞 CallKit Features

### Supported Features
- ✅ Native iOS CallKit integration
- ✅ Android full-screen call interface
- ✅ VoIP push notifications (iOS)
- ✅ FCM push notifications (Android)
- ✅ Background call handling
- ✅ WebView integration for in-app calls
- ✅ Call status synchronization

### Call Flow
1. **Incoming Call**: FCM/VoIP push → CallKit interface
2. **Accept**: WebView opens CallPanion web interface
3. **Decline/Timeout**: Status updated via API
4. **End Call**: Duration tracked and synced

## 🛠 Development Testing

### Test with Supabase Functions
1. Test FCM notification via `send-fcm-notification`:
```json
{
  "deviceToken": "DEVICE_FCM_TOKEN",
  "title": "Test Call",
  "body": "This is a test notification",
  "data": {
    "type": "incoming_call",
    "sessionId": "test-session-123",
    "relativeName": "Test Family",
    "callType": "in_app_call",
    "householdId": "test-household",
    "relativeId": "test-relative",
    "handle": "CallPanion",
    "duration": "30000"
  },
  "householdId": "test-household",
  "relativeId": "test-relative"
}
```

2. Test iOS VoIP notification via `send-apns-voip-notification`:
```json
{
  "voipToken": "DEVICE_VOIP_TOKEN",
  "deviceToken": "DEVICE_FCM_TOKEN",
  "title": "Incoming Call",
  "body": "Test Family is calling",
  "data": {
    "type": "incoming_call",
    "sessionId": "test-session-123",
    "relativeName": "Test Family",
    "callType": "in_app_call",
    "householdId": "test-household",
    "relativeId": "test-relative",
    "handle": "CallPanion",
    "duration": "30000"
  },
  "householdId": "test-household",
  "relativeId": "test-relative"
}
```

### Debug Logs
The app includes comprehensive debug logging:
- 📱 FCM message handling
- 📞 CallKit events  
- 🌐 WebView navigation
- 🔧 API calls

## 📋 Production Checklist

### iOS Requirements
- [ ] Apple Developer Account
- [ ] VoIP Services entitlement
- [ ] Push Notifications capability
- [ ] APNs VoIP certificate (.p8 key)

### Android Requirements  
- [ ] FCM project configuration
- [ ] Full Screen Intent permission (Android 14+)
- [ ] Notification permissions
- [ ] Signed APK for testing

### Backend Requirements
- [ ] `FCM_SERVICE_ACCOUNT_JSON` secret configured (Firebase Service Account)
- [ ] `ELEVENLABS_API_KEY` secret configured
- [ ] `ELEVEN_AGENT_ID_IN_APP` secret configured
- [ ] `APNS_KEY_ID` secret configured (iOS APNs Key ID)
- [ ] `APNS_TEAM_ID` secret configured (Apple Team ID)
- [ ] `APNS_KEY_BASE64` secret configured (APNs private key)
- [ ] `APNS_BUNDLE_ID` secret configured (iOS Bundle ID)
- [ ] `APNS_TOPIC_VOIP` secret configured (VoIP topic)
- [ ] `APNS_ENV` secret configured (sandbox/production)
- [ ] CallPanion web interface accessible

## 🚀 Deployment

### Build Commands
```bash
# Android
flutter build apk --release

# iOS  
flutter build ios --release
```

### Testing on Physical Device
1. **Git pull** project to local machine
2. **Configure Firebase** for your project
3. **Update constants.dart** with your URLs
4. **Build and install** on device
5. **Test CallKit** functionality

⚠️ **Important**: CallKit only works on physical devices, not simulators!