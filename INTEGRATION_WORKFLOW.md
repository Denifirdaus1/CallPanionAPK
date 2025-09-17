# 🔗 CallPanion Web-Flutter Integration Workflow

## 📋 Overview

Workflow ini dirancang untuk development yang seamless antara Lovable.dev (web project) dan Flutter APK, memungkinkan real-time integration testing dan debugging.

## 🏗️ Project Structure (Integrated)

```
callpanion_elderly/                     # Flutter APK (Main project)
├── lib/                               # Flutter source code
├── android/                           # Android-specific code
├── ios/                              # iOS-specific code
├── callpanion-web/                   # 🆕 Web project (from Lovable.dev)
│   ├── src/                          # React/Next.js source
│   ├── supabase/                     # Edge Functions & DB
│   └── public/                       # Static assets
├── CLAUDE.md                         # Development commands
├── INTEGRATION_GUIDE.md              # Technical integration specs
└── INTEGRATION_WORKFLOW.md          # 👈 This file
```

## 🚀 Development Workflow

### **Phase 1: Initial Setup**

#### 1.1 Download Web Project dari Lovable.dev
```bash
# 1. Export project dari Lovable.dev ke GitHub
# 2. Download ZIP atau clone repo
# 3. Extract ke callpanion-web/ directory

cd callpanion_elderly/
# Extract web project files ke callpanion-web/
```

#### 1.2 Verify Integration Points
```bash
# Check critical files ada:
ls callpanion-web/src/pages/elderly/    # WebView interface
ls callpanion-web/supabase/functions/   # Edge Functions
ls callpanion-web/src/services/         # API services
```

### **Phase 2: Daily Development Cycle**

#### 2.1 Update dari Lovable.dev (When needed)
```bash
# Ketika ada update dari Lovable.dev:
git checkout develop                    # Switch ke development branch
cd callpanion-web/
rm -rf *                               # Clear old web files
# Extract latest dari Lovable.dev export
git add .
git commit -m "sync: update web project from Lovable.dev"
```

#### 2.2 Integration Testing Workflow
```bash
# Setiap kali update web project:

# 1. Test Edge Functions connectivity
curl -X POST "https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/register-fcm-token" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"test": true}'

# 2. Test WebView URL accessibility
curl -I "https://your-domain.com/elderly/call?sessionId=test&platform=flutter"

# 3. Test Flutter build compatibility
flutter analyze
flutter test
flutter build apk --debug
```

#### 2.3 Real-time Integration Development
```bash
# Terminal 1: Web development server
cd callpanion-web/
npm run dev                    # http://localhost:3000

# Terminal 2: Flutter development
flutter run                   # Test on device/emulator

# Terminal 3: Supabase functions (if developing locally)
cd callpanion-web/
supabase start
supabase functions serve
```

### **Phase 3: Integration Validation**

#### 3.1 Critical Integration Points Check
```bash
# Must verify after each web update:

# ✅ Edge Functions URLs match Flutter constants
grep -r "supabase.co/functions" lib/utils/constants.dart
grep -r "functions/v1/" callpanion-web/src/

# ✅ WebView URLs accessible
grep -r "webCallBaseUrl" lib/utils/constants.dart
grep -r "/elderly/call" callpanion-web/src/

# ✅ API payload compatibility
grep -r "CallData" lib/models/
grep -r "sessionId\|relativeName" callpanion-web/src/
```

#### 3.2 End-to-End Integration Test
```bash
# Complete workflow test:
# 1. Web: Generate pairing code
# 2. Flutter: Pair device with code
# 3. Web: Trigger call
# 4. Flutter: Receive push notification
# 5. Flutter: Show CallKit interface
# 6. Flutter: Accept call → open WebView
# 7. WebView: Load web call interface
# 8. Complete call cycle
```

## 🔧 Integration Commands

### **Web Project Management**
```bash
# Install web dependencies
cd callpanion-web && npm install

# Start web development
cd callpanion-web && npm run dev

# Deploy Supabase functions
cd callpanion-web && supabase functions deploy

# Build web for production
cd callpanion-web && npm run build
```

### **Flutter Integration Testing**
```bash
# Test Flutter with local web server
flutter run --debug                    # Flutter connects to localhost:3000

# Test Flutter with production web
flutter run --release                  # Flutter connects to production URLs

# Test specific integration points
flutter test test/integration/         # Run integration tests
```

### **Cross-Project Debugging**
```bash
# Debug Edge Functions locally
cd callpanion-web
supabase functions serve --debug       # http://localhost:54321/functions/v1/

# Debug Flutter API calls
flutter run --verbose                  # Shows HTTP requests to Edge Functions

# Debug WebView integration
flutter run --debug                    # Enable WebView debugging
# Chrome DevTools: chrome://inspect    # Debug WebView content
```

## 📱 Integration Testing Checklist

### **After each Lovable.dev update:**

#### **🔍 Pre-Integration Check**
- [ ] Web project extracted ke `callpanion-web/`
- [ ] `package.json` dan `supabase/` folder ada
- [ ] Critical files present (elderly/call.tsx, Edge Functions)

#### **🔗 API Integration Check**
- [ ] Edge Function URLs sama dengan Flutter constants
- [ ] API payload structure compatible dengan Flutter models
- [ ] Database schema match dengan Flutter requirements

#### **📱 WebView Integration Check**
- [ ] Elderly call interface accessible dari Flutter WebView
- [ ] `platform=flutter` parameter handled correctly
- [ ] JavaScript bridge communication working
- [ ] Call controls functional in WebView

#### **🚨 Push Notification Check**
- [ ] FCM registration endpoint working
- [ ] Push payload format match Flutter expectations
- [ ] CallKit trigger working dengan notification data

#### **🔐 Security Integration Check**
- [ ] Device pairing flow end-to-end working
- [ ] Household isolation properly implemented
- [ ] RLS policies allow Flutter access
- [ ] JWT validation working between systems

## 🎯 Critical Integration Files

### **Must monitor for Flutter compatibility:**

#### **Backend Integration (Supabase)**
```bash
callpanion-web/supabase/functions/register-fcm-token/index.ts
callpanion-web/supabase/functions/updateCallStatus/index.ts
callpanion-web/supabase/functions/send-fcm-notification/index.ts
callpanion-web/supabase/functions/pair-claim/index.ts
callpanion-web/supabase/functions/elevenlabs-device-call/index.ts
```

#### **Frontend Integration (React)**
```bash
callpanion-web/src/pages/elderly/call.tsx                    # WebView interface
callpanion-web/src/components/call/WebRTCCallInterface.tsx   # Call handling
callpanion-web/src/services/api.js                          # API client
callpanion-web/src/utils/constants.js                       # Configuration
```

#### **Database Integration**
```bash
callpanion-web/supabase/migrations/                         # Schema changes
callpanion-web/supabase/types/                             # TypeScript types
```

### **Flutter files that depend on web project:**
```bash
lib/utils/constants.dart                                    # URLs & configuration
lib/models/call_data.dart                                   # API payload models
lib/services/api_service.dart                              # Edge Function calls
lib/screens/webview_call_screen.dart                       # WebView integration
```

## 🚨 Common Integration Issues & Solutions

### **❌ Issue: Edge Function URL Mismatch**
```bash
# Symptom: Flutter API calls fail dengan 404
# Solution:
grep -r "functions/v1/" callpanion-web/supabase/
# Update lib/utils/constants.dart dengan actual function names
```

### **❌ Issue: WebView Interface Tidak Load**
```bash
# Symptom: WebView shows blank/error page
# Solution:
curl -I "https://your-domain.com/elderly/call?sessionId=test"
# Check CORS, HTTPS, dan accessibility dari mobile
```

### **❌ Issue: API Payload Incompatible**
```bash
# Symptom: Edge Functions return error dengan Flutter requests
# Solution:
# Compare Flutter model dengan Edge Function expected payload:
cat lib/models/call_data.dart
cat callpanion-web/supabase/functions/*/index.ts
```

### **❌ Issue: Database Schema Mismatch**
```bash
# Symptom: RLS policy errors atau missing fields
# Solution:
# Check migration files compatible dengan Flutter models:
ls callpanion-web/supabase/migrations/
# Verify Flutter models match DB schema
```

## 🔄 Update & Sync Process

### **Weekly Sync (Recommended)**
```bash
# 1. Download latest dari Lovable.dev
# 2. Extract ke callpanion-web/
# 3. Run integration tests
# 4. Fix any breaking changes
# 5. Commit to version control
# 6. Deploy Edge Functions
# 7. Test end-to-end integration
```

### **Hotfix Process (Emergency)**
```bash
# If critical bug di web affects Flutter:
git checkout hotfix/web-integration-fix
# Download fixed version dari Lovable.dev
# Extract, test, commit
# Merge to main dan develop
```

## 📊 Integration Health Monitoring

### **Daily Checks**
```bash
# Automated integration health check:
./scripts/integration-health-check.sh

# Manual verification:
flutter analyze                        # No integration errors
curl -f https://[domain]/elderly/call  # WebView accessible
curl -f https://[project].supabase.co/functions/v1/register-fcm-token # Edge Functions up
```

### **Integration Metrics**
- ✅ Edge Function response time < 2s
- ✅ WebView load time < 3s
- ✅ Push notification delivery < 5s
- ✅ End-to-end call flow success rate > 95%

## 🎉 Benefits dari Setup Ini

### **✅ For Development**
- **Live debugging**: Dapat debug web dan Flutter integration secara real-time
- **No guessing**: Melihat actual code instead of assuming
- **Quick iteration**: Changes di web langsung bisa di-test dengan Flutter
- **Version sync**: Web dan Flutter always in sync di git

### **✅ For Integration**
- **Clear visibility**: Semua integration points terlihat jelas
- **Easy troubleshooting**: Dapat trace issues across web-Flutter boundary
- **Consistent API**: API payload dan schema always compatible
- **Confident deployment**: Integration fully tested sebelum production

### **✅ For Team Collaboration**
- **Single source of truth**: Satu repository untuk semua components
- **Shared context**: Tim Flutter dan web dapat understand full integration
- **Efficient communication**: Issues dapat di-reference dengan specific code
- **Quality assurance**: Integration breaks terdeteksi immediately

This workflow ensures **zero integration surprises** dan **seamless development experience**! 🚀