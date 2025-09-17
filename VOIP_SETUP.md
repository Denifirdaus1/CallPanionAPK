# VoIP Setup Guide for CallPanion Elderly App

## iOS Configuration

### Required Capabilities
1. **Push Notifications** - Enabled in Xcode
2. **Background Modes** - Enabled with:
   - Voice over IP
   - Remote notifications
   - Audio, AirPlay, and Picture in Picture (optional)

### Entitlements
The app requires the following entitlements in `Runner.entitlements`:
- `com.apple.developer.pushkit.voip` - Required for VoIP push notifications
- `com.apple.developer.aps-environment` - Set to "production" for App Store builds

### Info.plist Configuration
The following keys must be present:
- `NSMicrophoneUsageDescription` - For microphone access during calls
- `NSCameraUsageDescription` - For video calls (if supported)
- `UIBackgroundModes` - With `voip`, `audio`, and `remote-notification` values

### PushKit Integration
The app implements `PKPushRegistryDelegate` to handle VoIP push notifications:
- `pushRegistry(_:didReceiveIncomingPushWith:for:)` - Handles incoming VoIP notifications
- `pushRegistry(_:didUpdate:for:)` - Handles VoIP token updates
- `pushRegistry(_:didInvalidatePushTokenFor:)` - Handles token invalidation

## Android Configuration

### Required Permissions
The following permissions are declared in `AndroidManifest.xml`:
- `RECORD_AUDIO` - For microphone access
- `POST_NOTIFICATIONS` - For notifications (Android 13+)
- `FOREGROUND_SERVICE` - For foreground services
- `FOREGROUND_SERVICE_MICROPHONE` - For microphone in foreground services (Android 14+)
- `BLUETOOTH_CONNECT` - For Bluetooth audio routing (Android 12+)

### Dependencies
- ElevenLabs Android SDK v0.2.0
- Firebase Messaging for push notifications
- flutter_callkit_incoming for native call UI

## Server-Side Configuration

### APNs Setup
For iOS VoIP notifications, the server must:
1. Use the correct APNs topic (usually the app bundle ID with `.voip` suffix)
2. Set the `apns-push-type` header to `voip`
3. Use token-based authentication with a valid `.p8` key
4. Send push notifications to the VoIP token (not the regular APNs token)

### FCM Setup
For Android notifications, standard FCM configuration is used with notification channels for calls.

## End-to-End Flow

1. Flutter app registers for push notifications on both platforms
2. Tokens are sent to the backend server
3. When a call is initiated, server sends push notification:
   - iOS: VoIP push to PushKit endpoint
   - Android: Regular FCM notification
4. App receives notification and displays native call UI via CallKit
5. User accepts call, which triggers ElevenLabs WebRTC connection
6. Audio flows through ElevenLabs conversation
7. Call ends and session is cleaned up