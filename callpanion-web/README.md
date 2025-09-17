# CallPanion Web Project

## 📋 Overview

This directory contains the complete CallPanion web application that integrates with the Flutter APK. This setup allows for seamless development workflow where both web and mobile code are accessible in one project.

## 🏗️ Project Structure

```
callpanion-web/
├── src/
│   ├── components/           # React components
│   │   ├── call/            # Call-related components
│   │   ├── elderly/         # Elderly-specific UI
│   │   └── dashboard/       # Family dashboard
│   ├── pages/               # React pages/routes
│   │   ├── elderly/         # Elderly call interface
│   │   ├── dashboard/       # Family dashboard
│   │   └── auth/            # Authentication pages
│   ├── services/            # Frontend services
│   │   ├── api.js          # API communication
│   │   ├── websocket.js    # Real-time communication
│   │   └── webrtc.js       # WebRTC call handling
│   └── utils/               # Utility functions
├── supabase/
│   ├── functions/           # Edge Functions (CRITICAL for Flutter integration)
│   │   ├── register-fcm-token/     # FCM token registration
│   │   ├── updateCallStatus/       # Call status updates
│   │   ├── send-fcm-notification/  # Android push notifications
│   │   ├── send-apns-voip-notification/ # iOS VoIP notifications
│   │   ├── elevenlabs-device-call/ # ElevenLabs integration
│   │   ├── pair-claim/             # Device pairing
│   │   └── schedulerInAppCalls/    # Call scheduling
│   ├── migrations/          # Database schema
│   └── types/              # TypeScript types
├── public/                  # Static assets
└── docs/                   # Documentation
```

## 🔗 Integration with Flutter APK

### **Critical Integration Points:**

#### 1. **Edge Functions URLs**
Flutter APK calls these endpoints directly:
```dart
// In Flutter constants.dart - must match actual deployed URLs
static const String registerFcmTokenUrl = 'https://[PROJECT].supabase.co/functions/v1/register-fcm-token';
static const String updateCallStatusUrl = 'https://[PROJECT].supabase.co/functions/v1/updateCallStatus';
static const String pairClaimUrl = 'https://[PROJECT].supabase.co/functions/v1/pair-claim';
```

#### 2. **WebView Call Interface**
Flutter loads this URL in WebView:
```dart
final callUrl = '${AppConstants.webCallBaseUrl}/elderly/call'
    '?sessionId=${sessionId}'
    '&autoStart=true'
    '&platform=flutter';
```

#### 3. **Database Schema Compatibility**
Database tables must match Flutter models:
- `push_notification_tokens` ↔ Flutter FCM registration
- `call_sessions` ↔ Flutter call handling
- `device_pairs` ↔ Flutter pairing flow

## 🚀 Development Workflow

### **When updating from Lovable.dev:**

1. **Download latest code** from Lovable GitHub export
2. **Extract to this directory** (overwrite existing files)
3. **Verify integration points** with Flutter
4. **Test API compatibility** with Flutter constants
5. **Commit changes** to maintain version sync

### **Key Files to Monitor for Flutter Integration:**

```bash
# Critical for Flutter integration:
supabase/functions/*/index.ts     # API endpoints Flutter calls
src/pages/elderly/call.tsx        # WebView interface Flutter loads
src/services/api.js               # API payload structures
supabase/migrations/*.sql         # Database schema Flutter depends on
```

## 🔧 Development Commands

### **Start Development Server:**
```bash
cd callpanion-web
npm install
npm run dev
```

### **Deploy Supabase Functions:**
```bash
cd callpanion-web
supabase functions deploy --project-ref [PROJECT_ID]
```

### **Test Integration with Flutter:**
```bash
# Test Edge Functions connectivity
curl -X POST https://[PROJECT].supabase.co/functions/v1/register-fcm-token

# Test WebView URL accessibility
curl -I https://[DOMAIN]/elderly/call?sessionId=test
```

## 📱 Integration Testing Checklist

### **After each Lovable update:**

- [ ] **Edge Functions** still deploy successfully
- [ ] **API payloads** match Flutter expectations
- [ ] **WebView URLs** accessible from Flutter
- [ ] **Database schema** compatible with Flutter models
- [ ] **CORS settings** allow Flutter WebView access
- [ ] **Authentication flow** works with Flutter pairing

## 🎯 Critical Integration Files

### **Must be monitored for Flutter compatibility:**

1. **`supabase/functions/register-fcm-token/index.ts`**
   - Must accept Flutter FCM token format
   - Return success/error format Flutter expects

2. **`src/pages/elderly/call.tsx`**
   - Must work in Flutter WebView
   - Handle platform=flutter parameter
   - Communicate via window.CallPanion interface

3. **`supabase/functions/pair-claim/index.ts`**
   - Must generate codes Flutter can claim
   - Return pairing data Flutter stores

4. **Database migrations**
   - Schema must match Flutter model classes
   - RLS policies must allow Flutter access

## ⚠️ Important Notes

- **Never modify Flutter integration endpoints** without testing Flutter app
- **Always test WebView URLs** in mobile browser before deployment
- **Maintain API payload compatibility** between updates
- **Keep database schema in sync** with Flutter models
- **Test push notifications** work with Flutter FCM integration

## 🔄 Update Process

1. **Lovable.dev changes** → Download GitHub export
2. **Extract here** → Overwrite files in this directory
3. **Test integration** → Verify Flutter compatibility
4. **Commit changes** → Git commit with integration notes
5. **Deploy functions** → Update Supabase Edge Functions
6. **Test end-to-end** → Flutter ↔ Web integration working

This setup ensures both teams can see the complete picture and avoid integration surprises! 🎯