# Claude Configuration for CallPanion Elderly

## Project Overview
CallPanion Elderly adalah aplikasi Flutter native untuk in‑app calls dengan integrasi CallKit (iOS), FCM (Android), dan APNS VoIP (iOS). Tidak ada WebView untuk UI elderly. Aplikasi web React hanya berfungsi sebagai dashboard keluarga: pairing device, penjadwalan, monitoring, dan ringkasan panggilan.

## Development Commands
```
flutter pub get
flutter packages pub run build_runner build --delete-conflicting-outputs
flutter run -d <device>
flutter test
flutter analyze
```

## Build
- Android: `flutter build apk --release` atau `flutter build appbundle --release`
- iOS (macOS): `flutter build ios --release` atau `flutter build ipa --release`

## Platform Notes
- Android: `com.google.gms.google-services` aktif, `android/app/google-services.json` tersedia.
- iOS: `ios/Runner/GoogleService-Info.plist`, entitlements (`aps-environment`, `com.apple.developer.pushkit.voip`), `UIBackgroundModes` (voip, remote-notification, audio).

## Project Structure (Flutter)
- `lib/services/`: `fcm_service.dart`, `callkit_service.dart`, `elevenlabs_call_service.dart`, `api_service.dart`
- `lib/models/`: `call_data.dart`, `device_info.dart` (+ generated `*.g.dart`)
- `lib/screens/`: `main_screen.dart`, `call_screen.dart`
- `lib/utils/`: `constants.dart`

## Dependencies (utama)
- `flutter_callkit_incoming`, `firebase_messaging`, `firebase_core`, `shared_preferences`, `permission_handler`, `connectivity_plus`, `just_audio`, `audio_session`

## Backend (Supabase Edge Functions)
- Notifikasi: `send-fcm-notification` (FCM v1 OAuth dengan `FCM_SERVICE_ACCOUNT_JSON`), `send-apns-voip-notification` (JWT; `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_BASE64`, `APNS_BUNDLE_ID`, `APNS_TOPIC_VOIP`, `APNS_ENV`).
- Panggilan: `elevenlabs-device-call` (mulai/akhir, kembalikan `conversationToken` untuk native bridge), `updateCallStatus` (sinkronisasi status/log).
- Pairing & Scheduler: `pair-init`, `pair-claim`, `schedulerInAppCalls`.

## Important (Do/Don’t)
- DO: Gunakan native bridge untuk ElevenLabs call, FCM/VoIP untuk notifikasi, dan CallKit untuk UI panggilan.
- DO: Jaga rahasia (APNS/FCM) via Supabase secrets, bukan di repo.
- DON’T: Tambah atau gunakan WebView untuk UI elderly. Jangan membuat/merujuk endpoint `/elderly/call` di web.
- DON’T: Gunakan `FCM_SERVER_KEY`/`FIREBASE_PROJECT_ID` di fungsi FCM v1 — cukup `FCM_SERVICE_ACCOUNT_JSON`.
