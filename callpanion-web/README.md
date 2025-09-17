# CallPanion - AI-Powered Family Connection Platform

## Project Overview

CallPanion is an innovative family communication platform that uses AI-powered voice calls to help families stay connected with their elderly relatives. The system combines web-based family dashboards with native mobile apps for seamless, scheduled, and intelligent conversations.

**Live URL**: https://lovable.dev/projects/a4b57244-d3ad-47ea-85ca-c99941e17d30

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/a4b57244-d3ad-47ea-85ca-c99941e17d30) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Key Features

- **AI-Powered Conversations**: Scheduled voice calls using ElevenLabs AI agents
- **Family Dashboard**: Web-based interface for managing relatives and viewing call summaries
- **Flutter Mobile App**: Native Android/iOS app for elderly users with CallKit integration
- **Smart Scheduling**: Timezone-aware call scheduling (morning, afternoon, evening)
- **Real-time Insights**: Mood tracking, conversation analysis, and wellbeing trends
- **Multi-Call Methods**: Support for both batch calling and in-app calling
- **Push Notifications**: FCM (Android) and APNs (iOS) for call notifications
- **Secure Multi-tenant**: Row Level Security (RLS) for household data isolation

## Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn-ui
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **AI Voice**: ElevenLabs Conversational AI with WebRTC
- **Mobile**: Flutter with native platform bridges
- **Notifications**: Firebase Cloud Messaging + Apple Push Notification Service

### System Components
- **Web Dashboard**: Family member management and call monitoring
- **Elder App**: Flutter app with native calling experience
- **Scheduler**: Automated daily call dispatch via cron
- **Webhooks**: Real-time call status and summary processing
- **Analytics**: Conversation insights and wellbeing tracking

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/a4b57244-d3ad-47ea-85ca-c99941e17d30) and click on Share -> Publish.

## Content Security Policy (CSP)

This project uses different CSP configurations for different environments:

### Preview Environment (Current)
- Uses a relaxed CSP policy to support Lovable preview functionality
- Allows `unsafe-eval` and `unsafe-inline` for development convenience
- Permits scripts from `cdn.gpteng.co` for Lovable editor integration

### Production Environment (Planned)
- Will use strict CSP with nonce-based or strict-dynamic policies
- No `unsafe-eval` or `unsafe-inline` allowed
- Hash-based or nonce-based script loading

### Allowed Domains
- `*.supabase.co` - Supabase backend services
- `*.supabase.in` - Supabase alternative endpoints
- `api.elevenlabs.io` - ElevenLabs API for voice calls
- `cdn.gpteng.co` - Lovable preview scripts (preview only)
- `www.google-analytics.com` - Analytics (production)

## Setup & Configuration

### Prerequisites
- Node.js 18+ and npm
- Supabase project
- ElevenLabs API key and Agent ID
- Resend API key (for email verification)
- Apple Developer Account (for iOS push notifications)
- Firebase project (for Android FCM)

### Environment Setup

#### Supabase Secrets
Configure these secrets in your Supabase Edge Functions:

**ElevenLabs Configuration:**
```
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVEN_AGENT_ID_IN_APP=your_agent_id_for_in_app_calls
```

**iOS APNs Configuration:**
```
APNS_KEY_ID=your_apple_key_id
APNS_TEAM_ID=your_apple_team_id
APNS_KEY_BASE64=your_p8_key_base64_encoded
APNS_BUNDLE_ID=app.lovable.a4b57244d3ad47ea85cac99941e17d30
APNS_TOPIC_VOIP=app.lovable.a4b57244d3ad47ea85cac99941e17d30.voip
APNS_ENV=production
```

**Email Configuration:**
```
RESEND_API_KEY=your_resend_api_key
```

#### Supabase Authentication
**URL Configuration:**
- Site URL: `https://preview--callpanion.lovable.app`
- Additional Redirect URLs: `https://preview--callpanion.lovable.app/auth/callback`

**Email Settings:**
- Configure Resend SMTP integration
- Set minimum email interval to 60 seconds

### Authentication & Onboarding Flow
1. **Signup**: User creates account with email verification
2. **Email Confirmation**: Click verification link → `/auth/callback`
3. **Onboarding**: 3-step process if no household exists:
   - Household Setup
   - Relative Setup (elderly family members)
   - Schedule Setup (call times and timezone)
4. **Dashboard**: Access family dashboard and call management

### Mobile App Setup

#### Flutter Dependencies
Key packages included:
- `flutter_callkit_incoming` - Native call integration
- `firebase_messaging` - Push notifications
- `webview_flutter` - In-app web calls
- `permission_handler` - Runtime permissions

#### iOS Configuration
**Required Capabilities (Xcode):**
- Push Notifications
- Background Modes: Voice over IP, Remote notifications, Audio

**Info.plist Settings:**
- Microphone usage description
- Background modes for VoIP
- Bundle identifier matching APNs configuration

#### Android Configuration
**Required Permissions:**
- `RECORD_AUDIO` - Microphone access
- `POST_NOTIFICATIONS` - Android 13+ notifications
- `BLUETOOTH_CONNECT` - Bluetooth audio routing
- `FOREGROUND_SERVICE_MICROPHONE` - Background call service

**Build Configuration:**
- JDK 17+
- ElevenLabs Android SDK 0.2.0
- Firebase Cloud Messaging integration

## Call Flow Architecture

### End-to-End Call Process
1. **Call Initiation**: 
   - Scheduler triggers daily calls via cron → `schedulerDailyCalls` Edge Function
   - Or manual call initiation via dashboard
   
2. **Token Generation**:
   - Edge Function `elevenlabs-device-call` requests conversation token from ElevenLabs
   - Returns token + metadata to mobile app
   
3. **Native Call Handling**:
   - Flutter app receives push notification (FCM/APNs)
   - Native platform shows CallKit interface
   - User accepts → Flutter calls native bridge with conversation token
   
4. **WebRTC Connection**:
   - Native ElevenLabs SDK starts conversation with token
   - WebRTC audio session established
   - Returns `conversationId` to Flutter
   
5. **Database Sync**:
   - Flutter calls `update_conversation_id` Edge Function
   - Updates `call_logs` and `call_sessions` tables
   
6. **Call Completion**:
   - User ends call → Native SDK terminates session
   - Flutter calls Edge Function with call duration/status
   - AI analysis generates call summary and mood tracking

### Data Security
- **Row Level Security (RLS)**: All database access scoped to `household_id`
- **Multi-tenant isolation**: Each family's data completely separated
- **Token-based auth**: No API keys exposed to client applications
- **HMAC webhook verification**: ElevenLabs webhook payloads verified

## Quality Assurance

The project includes comprehensive testing framework in `/qa/`:
- **E2E Tests**: Playwright tests for complete user workflows
- **Security Tests**: RLS policy verification and access control testing
- **Database Tests**: Data integrity and constraint validation
- **Multi-role Testing**: Family admin, member, and elderly user scenarios

Run tests: `cd qa/e2e && npm test`

## Development

### Local Development
```bash
npm install
npm run dev
```

### Flutter App Development
```bash
cd elderly_app
flutter pub get
flutter run
```

### Supabase Local Development
```bash
supabase start
supabase db reset
```

## Deployment

### Web Application
Deploy via Lovable dashboard: **Share → Publish**

### Mobile Applications
- **iOS**: Build via Xcode, deploy to App Store
- **Android**: Build APK/AAB, deploy to Google Play Store

### Domain Configuration
Connect custom domain: **Project > Settings > Domains**

## Support & Documentation

- **QA Framework**: `/qa/README.md`
- **Flutter App Setup**: `/elderly_app/README.md`
- **Technical Audit**: `CALLPANION_TECHNICAL_AUDIT_REPORT.md`
- **Lovable Documentation**: [docs.lovable.dev](https://docs.lovable.dev/)
