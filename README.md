# CallPanion Elderly Flutter App

Flutter APK untuk elderly dengan native CallKit integration.

## Setup & Installation

### 1. Dependencies Required
```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_callkit_incoming: ^3.0.0
  firebase_messaging: ^15.0.4
  uuid: ^4.0.0
  webview_flutter: ^4.4.2
  shared_preferences: ^2.2.2
  http: ^1.1.0
  json_annotation: ^4.8.1
  
dev_dependencies:
  flutter_test:
    sdk: flutter
  json_serializable: ^6.7.1
  build_runner: ^2.4.7
```

### 2. Platform Configuration

#### Android (android/app/src/main/AndroidManifest.xml)
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>
    
    <application
        android:name="${applicationName}"
        android:exported="false"
        android:icon="@mipmap/ic_launcher">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleInstance"
            android:theme="@style/LaunchTheme"
            android:orientation="portrait"
            android:screenOrientation="portrait"
            android:showWhenLocked="true"
            android:turnScreenOn="true">
            
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        
        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
</manifest>
```

#### iOS (ios/Runner/Info.plist)
```xml
<key>UIBackgroundModes</key>
<array>
    <string>voip</string>
    <string>remote-notification</string>
    <string>processing</string>
</array>
```

### 3. Project Structure
```
lib/
├── main.dart
├── models/
│   ├── call_data.dart
│   └── device_info.dart
├── services/
│   ├── callkit_service.dart
│   ├── fcm_service.dart
│   └── api_service.dart
├── screens/
│   ├── main_screen.dart
│   ├── call_screen.dart
│   └── webview_call_screen.dart
└── utils/
    └── constants.dart
```

## Features
- ✅ Native call experience (iOS CallKit + Android custom UI)
- ✅ VoIP push notifications
- ✅ WebView integration for in-app calls
- ✅ Automatic token registration
- ✅ Call status handling (accept/decline/end)
- ✅ Background call processing

## API Integration
- Backend: CallPanion Supabase Edge Functions
- Push: Firebase Cloud Messaging + Apple VoIP
- Calls: WebView integration with CallPanion web interface