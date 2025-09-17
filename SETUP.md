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
- `register-fcm-token` - Register device tokens
- `updateCallStatus` - Update call statuses (accept/decline/end)
- `check-scheduled-calls` - Check for pending calls

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

### Test with Firebase Console
1. Send test FCM messages with this payload:
```json
{
  "to": "DEVICE_FCM_TOKEN",
  "data": {
    "type": "incoming_call",
    "sessionId": "test-session-123",
    "relativeName": "Test Family",
    "callType": "in_app_call",
    "householdId": "test-household",
    "relativeId": "test-relative",
    "handle": "CallPanion",
    "duration": "30000"
  }
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
- [ ] APNS_JWT_TOKEN secret configured
- [ ] FCM_SERVICE_ACCOUNT_JSON secret configured  
- [ ] iOS bundle ID configured
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