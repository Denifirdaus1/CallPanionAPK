# CallPanion Elderly Flutter App

Native Flutter app for elderly users with CallKit (iOS) and full-screen incoming call UI (Android). Push handled via Firebase Cloud Messaging (FCM) on Android and APNS VoIP on iOS. No WebView is used -- the elderly UI is fully native Flutter.

## Setup
- Dependencies (see `pubspec.yaml`): `flutter_callkit_incoming`, `firebase_messaging`, `firebase_core`, `shared_preferences`, `permission_handler`, `connectivity_plus`, `just_audio`, `audio_session`.
- Android:
  - Place `android/app/google-services.json`.
  - Ensure Gradle plugin `com.google.gms.google-services` is applied.
- iOS:
  - Place `ios/Runner/GoogleService-Info.plist`.
  - `ios/Runner/Runner.entitlements` must include `aps-environment` and `com.apple.developer.pushkit.voip`.
  - `UIBackgroundModes` in `Info.plist`: `voip`, `remote-notification`, `audio`.

## Project Structure
- `lib/services/`: FCM (`fcm_service.dart`), CallKit (`callkit_service.dart`), ElevenLabs (`elevenlabs_call_service.dart`), API (`api_service.dart`).
- `lib/models/`: `call_data.dart`, `device_info.dart` (+ generated `*.g.dart`).
- `lib/screens/`: `main_screen.dart`, `call_screen.dart`.
- `lib/utils/`: `constants.dart` (Supabase URLs/keys/constants).

## Features
- Native call experience (CallKit iOS + full-screen incoming UI Android)
- Push notifications:
  - Android: FCM (Firebase)
  - iOS: APNS VoIP (PushKit)
- ElevenLabs in-app call via native bridge; conversation token from Edge Function
- Call status updates (accept/decline/end) and background handling

## Family Web Dashboard (React)
- Production route for in-app call: `/dashboard/in-app`
- Main page: `callpanion-web/src/pages/InAppDashboard.tsx`
- Components used by the page:
  1. `InAppCallScheduleManager`
  2. `InAppCallScheduleSettings`
  3. `DevicePairingManager`
  4. `PairedDevicesStatus`
- Components such as `InAppCallDashboard.tsx` or `ConversationInsightsDashboard.tsx` are legacy and not used.

## Backend Integration (Supabase Edge Functions)
- Notifications:
  - `send-fcm-notification` (FCM v1 OAuth; requires `FCM_SERVICE_ACCOUNT_JSON`)
  - `send-apns-voip-notification` (JWT; requires `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_BASE64`, `APNS_BUNDLE_ID`, `APNS_TOPIC_VOIP`, `APNS_ENV`)
- Calls:
  - `elevenlabs-device-call` (start/end, returns `conversationToken` for native bridge)
  - `updateCallStatus` (synchronizes session/log outcomes)
- Pairing & scheduler: `pair-init`, `pair-claim`, `schedulerInAppCalls`

> Note: The React web app is for the family dashboard (pairing, scheduling, monitoring, summaries). The elderly UI remains native Flutter.
