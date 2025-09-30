# CallPanion Elderly Flutter App

Native Flutter app untuk elderly users dengan ElevenLabs conversational AI integration, CallKit (iOS), dan full-screen incoming call UI (Android). Push notifications via Firebase Cloud Messaging (FCM) pada Android dan APNS VoIP pada iOS. UI sepenuhnya native Flutter tanpa WebView.

## Setup
- **Dependencies** (lihat `pubspec.yaml`):
  - Core: `flutter_callkit_incoming`, `firebase_messaging`, `firebase_core`
  - ElevenLabs: `elevenlabs-android:0.2.0` (Official SDK)
  - Utils: `shared_preferences`, `permission_handler`, `connectivity_plus`
  - Audio: `just_audio`, `audio_session`
  - HTTP: `http`, `uuid`
- **Android**:
  - Place `android/app/google-services.json`
  - Ensure Gradle plugin `com.google.gms.google-services` is applied
  - ElevenLabs SDK: `io.elevenlabs:elevenlabs-android:0.2.0`
- **iOS**:
  - Place `ios/Runner/GoogleService-Info.plist`
  - `ios/Runner/Runner.entitlements` must include `aps-environment` dan `com.apple.developer.pushkit.voip`
  - `UIBackgroundModes` in `Info.plist`: `voip`, `remote-notification`, `audio`

## ElevenLabs Integration
- **Official Android SDK**: `io.elevenlabs:elevenlabs-android:0.2.0`
- **Native Bridge**: `ElevenLabsBridge.kt` untuk komunikasi Flutter ↔ Native
- **WebRTC**: ElevenLabs SDK sudah include WebRTC (tidak perlu dependency tambahan)
- **Conversation Token**: Diambil dari Edge Function `elevenlabs-conversation-token`
- **Real-time Events**: Voice Activity Detection, feedback, contextual updates
- **Audio Session**: `MODE_IN_COMMUNICATION` untuk VoIP calls

## Project Structure
- `lib/services/`:
  - `elevenlabs_call_service.dart` - ElevenLabs conversational AI integration
  - `callkit_service.dart` - CallKit & native call UI
  - `fcm_service.dart` - Firebase Cloud Messaging
  - `api_service.dart` - Backend API communication
  - `app_lifecycle_service.dart` - App lifecycle & pending call management
  - `network_service.dart` - Network connectivity monitoring
  - `permission_service.dart` - Permission management
- `lib/screens/`:
  - `main_screen.dart` - Main app screen dengan device pairing
  - `call_screen.dart` - In-app call UI dengan ElevenLabs controls
  - `pairing_screen.dart` - Device pairing interface
- `lib/models/`:
  - `call_data.dart` - Call data model
  - `device_info.dart` - Device information model
- `lib/utils/`:
  - `constants.dart` - Supabase URLs, API keys, constants
  - `connection_test.dart` - Connection testing utilities
- `android/app/src/main/kotlin/`:
  - `ElevenLabsBridge.kt` - Native bridge untuk ElevenLabs SDK

## Features
- **ElevenLabs Conversational AI**: Real-time voice conversation dengan AI agent
- **Native Call Experience**: CallKit (iOS) + full-screen incoming UI (Android)
- **Push Notifications**: FCM (Android) + APNS VoIP (iOS)
- **Device Pairing**: 6-digit code pairing system
- **Call Management**: Accept/decline/end dengan status tracking
- **Background Handling**: Pending call management saat app di background
- **Audio Controls**: Mute/unmute, feedback, contextual updates
- **Network Monitoring**: Connectivity status monitoring
- **Permission Management**: Microphone, notification, bluetooth permissions

## Family Web Dashboard (React)
- Production route untuk in-app call: `/dashboard/in-app`
- Main page: `callpanion-web/src/pages/InAppDashboard.tsx`
- Components yang digunakan:
  1. `InAppCallScheduleManager`
  2. `InAppCallScheduleSettings`
  3. `DevicePairingManager`
  4. `PairedDevicesStatus`
- Components seperti `InAppCallDashboard.tsx` atau `ConversationInsightsDashboard.tsx` adalah legacy dan tidak digunakan

## Backend Integration (Supabase Edge Functions)
- **ElevenLabs Integration**:
  - `elevenlabs-conversation-token` - Generate conversation token untuk ElevenLabs SDK
  - `elevenlabs-device-call` - Device call management & conversation ID updates
  - `elevenlabs-webhook` - Handle ElevenLabs webhooks untuk call outcomes
- **Notifications**:
  - `send-fcm-notification` - FCM v1 API dengan OAuth
  - `send-apns-voip-notification` - APNS VoIP dengan JWT
- **Call Management**:
  - `updateCallStatus` - Call status synchronization
  - `schedulerInAppCalls` - Call scheduling & execution
- **Device Management**:
  - `pair-init` - Generate pairing token
  - `pair-claim` - Complete device pairing
  - `register-fcm-token` - FCM token registration

## Technical Implementation
- **ElevenLabs SDK**: Official Android SDK v0.2.0 dari Maven Central
- **WebRTC**: ElevenLabs SDK sudah include WebRTC (tidak perlu dependency tambahan)
- **MethodChannel**: `app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/conversation`
- **EventChannel**: `app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/events`
- **Audio Session**: `MODE_IN_COMMUNICATION` untuk VoIP calls
- **Permissions**: `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `BLUETOOTH_CONNECT`

> Note: React web app untuk family dashboard (pairing, scheduling, monitoring, summaries). Elderly UI tetap native Flutter dengan ElevenLabs conversational AI integration.