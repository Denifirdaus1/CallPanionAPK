# Claude Configuration for CallPanion Elderly

## Project Overview
CallPanion Elderly is a Flutter VoIP calling application designed for elderly users with native CallKit integration, Firebase Cloud Messaging, and WebView functionality for seamless call experiences.

## Development Commands

### Setup & Dependencies
```bash
# Install dependencies
flutter pub get

# Generate code (for JSON serialization)
flutter packages pub run build_runner build

# Clean generated files and rebuild
flutter packages pub run build_runner build --delete-conflicting-outputs
```

### Development
```bash
# Run app in development mode
flutter run

# Run with specific device
flutter run -d <device_id>

# Hot reload (during development)
r

# Hot restart (during development)
R

# Clean build artifacts
flutter clean
```

### Testing & Analysis
```bash
# Run all tests
flutter test

# Run tests with coverage
flutter test --coverage

# Analyze code for issues
flutter analyze

# Format code
dart format .
```

### Building

#### Android
```bash
# Build debug APK
flutter build apk --debug

# Build release APK
flutter build apk --release

# Build app bundle for Play Store
flutter build appbundle --release
```

#### iOS
```bash
# Build for iOS (requires macOS)
flutter build ios --release

# Build IPA for distribution
flutter build ipa --release
```

### Debugging
```bash
# Run with debugging enabled
flutter run --debug

# Profile performance
flutter run --profile

# Check device info
flutter devices

# Doctor check
flutter doctor
```

### Platform-Specific Notes

#### Android Configuration
- Minimum SDK: 21 (Android 5.0)
- Target SDK: Latest stable
- Permissions: INTERNET, POST_NOTIFICATIONS, USE_FULL_SCREEN_INTENT
- Features: CallKit integration, Firebase messaging

#### iOS Configuration
- iOS 11.0+ required for CallKit
- Background modes: voip, remote-notification, processing
- VoIP push notifications configured
- CallKit integration for native call UI

### Firebase Integration
- Firebase Core initialized in main.dart
- FCM for push notifications
- VoIP notifications for iOS

### Project Structure
```
lib/
├── main.dart                 # App entry point
├── models/                   # Data models
│   ├── call_data.dart       # Call data structure
│   └── device_info.dart     # Device information
├── services/                 # Business logic services
│   ├── callkit_service.dart # CallKit integration
│   ├── fcm_service.dart     # Firebase messaging
│   ├── api_service.dart     # API communication
│   ├── permission_service.dart # Permissions handling
│   └── network_service.dart # Network connectivity
├── screens/                  # UI screens
│   ├── main_screen.dart     # Main app screen
│   ├── call_screen.dart     # Call interface
│   └── webview_call_screen.dart # WebView integration
└── utils/
    └── constants.dart        # App constants
```

### Common Issues & Solutions

#### Permission Issues
```bash
# Check current permissions
flutter run --verbose
```

#### Build Issues
```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter build apk
```

#### iOS Build Issues
```bash
# Clean iOS build
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
flutter clean
flutter build ios
```

### Development Workflow
1. Make changes to code
2. Test with `flutter analyze`
3. Run tests with `flutter test`
4. Build and test on device with `flutter run`
5. For release: `flutter build apk --release`

### Environment
- Flutter SDK: 3.35.3+
- Dart: 3.9.2+
- Android SDK: 34+
- iOS: 11.0+

### Dependencies
Key packages used:
- flutter_callkit_incoming: Native call experience
- firebase_messaging: Push notifications
- firebase_core: Firebase integration
- webview_flutter: In-app call interface
- shared_preferences: Local storage
- permission_handler: Runtime permissions
- connectivity_plus: Network status
- wakelock_plus: Screen wake management