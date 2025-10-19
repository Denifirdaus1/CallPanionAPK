# Callpanion - AI-Powered Family Communication Platform

## Overview

Callpanion is an innovative AI-powered communication platform designed specifically for elderly family members. It combines real-time voice conversations with AI companions, family chat, and photo sharing to keep families connected across distances.

## Key Features

- **AI Voice Conversations**: Real-time voice calls with ElevenLabs AI agents
- **Family Chat**: Text and photo sharing between family members
- **Photo Gallery**: Shared memories and family photos
- **Call Scheduling**: Automated call scheduling with timezone support
- **Device Pairing**: Simple 6-digit code or QR code pairing
- **Elderly-Friendly UI**: Large fonts, high contrast, simple navigation
- **Cross-Platform**: Flutter mobile app + React web dashboard

## System Architecture

### Technology Stack

**Frontend:**
- **Flutter** (Mobile App) - Dart
- **React + TypeScript** (Web Dashboard) - Vite
- **Google Fonts** (Fraunces) - Typography

**Backend:**
- **Supabase** - Database & Authentication
- **Supabase Edge Functions** - Serverless functions
- **ElevenLabs** - AI Voice Conversations
- **Firebase Cloud Messaging** - Android notifications
- **Apple Push Notifications** - iOS notifications

**Database:**
- **PostgreSQL** (via Supabase)
- **Real-time subscriptions**
- **Row Level Security (RLS)**

## Complete System Flow

### 1. 📅 Scheduling Phase (Web Dashboard)

**Location:** `callpanion-web/src/components/InAppCallScheduleSettings.tsx`

**Process:**
1. Family members access the web dashboard
2. Configure call schedules for each relative:
   - Morning, afternoon, and evening call times
   - Timezone selection (WIB/WITA/WIT/GMT/EST)
   - Enable/disable schedule per relative
3. Data is saved to `call_schedules` table in Supabase
4. Schedules are linked to specific `relative_id` and `household_id`

**Key Components:**
- Time picker for each call slot
- Timezone dropdown with Indonesian timezones
- Toggle switches for schedule activation
- Real-time validation and error handling

### 2. 🔗 Device Pairing Phase (Web Dashboard)

**Location:** `callpanion-web/src/components/DevicePairingManager.tsx`

**Process:**
1. Generate 6-digit pairing codes for each relative
2. Create QR codes containing pairing information
3. Display both 6-digit code and QR code for easy pairing
4. Set expiration time (typically 10 minutes)
5. Data is saved to `device_pairs` table

**Key Components:**
- QR code generation using `react-qr-code`
- 6-digit code display with copy functionality
- Relative selection dropdown
- Token management and cleanup

### 3. 📱 Mobile App Pairing Phase (Flutter)

**Location:** `lib/screens/pairing_screen.dart`

**Process:**
1. User opens Flutter app
2. Scans QR code OR enters 6-digit code manually
3. App validates pairing token with backend
4. Upon successful validation:
   - Save pairing data to local storage
   - Register FCM/VoIP token for notifications
   - Authenticate with Supabase for chat access
   - Navigate to main screen

**Key Components:**
- QR code scanner using `mobile_scanner`
- Manual code input with validation
- Error handling and user feedback
- Local storage management

### 4. ⏰ Notification Scheduling Phase (Edge Functions)

**Location:** `supabase/functions/schedulerInAppCalls/`

**Process:**
1. **Phase 1 - Queue Notifications (5 minutes before):**
   - Check active schedules for current time
   - Create notification entries in `notification_queue` table
   - Include relative info, household info, and call type
   - Detect device platform and tokens from `device_pairs`

2. **Phase 2 - Execute Notifications (at scheduled time):**
   - Process queued notifications
   - Send platform-specific notifications:
     - **Android**: FCM push notification via `send-fcm-notification`
     - **iOS**: VoIP push notification via `send-apns-voip-notification`
   - Create call sessions and logs

**Key Components:**
- Enhanced 2-phase scheduling system
- Device token detection from `device_pairs` and `push_notification_tokens`
- Platform-specific notification routing
- Retry mechanism and error handling
- Real-time broadcasting to dashboard

### 5. 📞 CallKit Integration Phase (Mobile)

**Location:** `lib/services/callkit_service.dart`

**Process:**
1. Receive incoming call notification
2. Display native call interface with:
   - "Callpanion" as caller name
   - Orange background with Callpanion icon
   - "Answer" and "Decline" buttons
3. Handle user actions:
   - **Answer**: Navigate to call screen, start WebRTC connection
   - **Decline**: Update call status, clear notification
4. Update call status in database

**Key Components:**
- CallKit integration for iOS
- Custom notification UI for Android
- Call state management
- Navigation handling

### 6. 🎙️ AI Conversation Phase (ElevenLabs)

**Location:** `lib/services/elevenlabs_call_service.dart` & `android/app/src/main/kotlin/.../ElevenLabsBridge.kt`

**Process:**
1. **Call Initiation:**
   - Call `elevenlabs-device-call` Edge Function
   - Get WebRTC token and conversation ID
   - Start real-time audio connection

2. **Real-time Communication:**
   - Handle microphone permissions
   - Stream audio to ElevenLabs servers
   - Receive AI responses in real-time
   - Process conversation events

3. **Event Handling:**
   - `conversationConnected` - Connection established
   - `conversationEvent` - Messages, VAD scores, feedback
   - `conversationEnded` - Call completion

**Key Components:**
- WebRTC token management
- Audio streaming and processing
- Event channel communication
- Native Android bridge

### 7. 📊 Data Collection Phase (Webhook)

**Location:** `supabase/functions/elevenlabs-webhook/index.ts`

**Process:**
1. Receive post-call webhook from ElevenLabs
2. Extract conversation data:
   - Detailed summary and TL;DR
   - Transcript and audio URLs
   - Mood and sentiment analysis
   - Criteria evaluation scores
   - Call success status

3. Process and store data:
   - Update `call_logs` table with call outcome
   - Create `call_summaries` entry with AI analysis
   - Store audio files and transcripts
   - Calculate mood and criteria scores

**Key Components:**
- Webhook signature verification
- Data extraction and normalization
- Database updates and error handling
- Audio file processing

### 8. 📈 Dashboard Display Phase (Web)

**Location:** `callpanion-web/src/pages/InAppDashboard.tsx`

**Process:**
1. Display call history and statistics
2. Show conversation summaries and insights
3. Present mood trends and criteria scores
4. Enable real-time chat with family members
5. Manage device pairing and schedules

**Key Components:**
- Real-time data subscriptions
- Interactive charts and graphs
- Family chat integration
- Device management interface

## Database Schema

### Core Tables

**`households`**
- Family groups and their information
- Location and timezone data
- Call method preferences

**`relatives`**
- Individual family members
- Personal information and preferences
- Timezone and call cadence settings

**`device_pairs`**
- Paired mobile devices
- Pairing tokens and device information
- Claim status and timestamps

**`call_schedules`**
- Call timing configurations
- Morning, afternoon, evening slots
- Timezone and activation status

**`call_logs`**
- Individual call records
- Call outcomes and durations
- Provider and call type information

**`call_summaries`**
- AI-generated call analysis
- Summaries, transcripts, and mood scores
- Criteria evaluation results

**`chat_messages`**
- Family chat messages
- Text and photo content
- Timestamps and user information

### Supporting Tables

**`notification_queue`**
- Scheduled notification entries
- Execution status and retry logic
- Platform-specific data

**`webhook_events`**
- Webhook processing logs
- Success/failure tracking
- Debug information

**`push_notification_tokens`**
- FCM and VoIP tokens
- Platform and device information
- Token validation and updates
- User association and pairing info

**`notification_queue`**
- Queued notification entries
- Execution status and retry logic
- Platform-specific data and tokens

## Edge Functions

### `elevenlabs-device-call`
- **Purpose**: Manage ElevenLabs call lifecycle
- **Actions**: start, end, update_conversation_id
- **Features**: Device validation, call logging, WebRTC token management

### `elevenlabs-webhook`
- **Purpose**: Process post-call data from ElevenLabs
- **Features**: Data extraction, normalization, database updates
- **Output**: Call summaries, mood analysis, criteria scores

### `send-fcm-notification`
- **Purpose**: Send FCM notifications to Android devices
- **Features**: JWT OAuth authentication, token validation, FCM v1 API
- **Integration**: Google OAuth, Firebase Cloud Messaging

### `send-push-notification`
- **Purpose**: Send notifications to multiple users
- **Platforms**: Android (FCM), iOS (VoIP fallback)
- **Features**: Device detection, platform-specific routing
- **Integration**: FCM, APNs VoIP

### `send-apns-voip-notification`
- **Purpose**: Send VoIP push notifications to iOS devices
- **Features**: APNs JWT authentication, CallKit integration
- **Integration**: Apple Push Notification service

### `schedulerInAppCalls`
- **Purpose**: Enhanced 2-phase notification scheduling
- **Phase 1**: Queue notifications 5 minutes before execution
- **Phase 2**: Execute notifications at scheduled time
- **Features**: Device detection, retry logic, real-time broadcasting

## Mobile App Structure

### Screens

**`MainScreen`**
- Device status and navigation
- Family information display
- Quick access to chat and gallery

**`PairingScreen`**
- QR code scanning
- Manual code input
- Device validation and pairing

**`CallScreen`**
- Active call interface
- Audio controls and feedback
- Real-time conversation display

**`ChatScreen`**
- Family chat messages
- Photo sharing
- Real-time message updates

**`GalleryScreen`**
- Shared family photos
- Image viewing and management
- Photo upload and organization

### Services

**`CallKitService`**
- Incoming call handling
- CallKit integration
- Call state management

**`ElevenLabsCallService`**
- WebRTC connection management
- Event handling and processing
- Audio streaming and control

**`ChatService`**
- Message loading and sending
- Real-time subscriptions
- Photo upload and management

**`ApiService`**
- Backend communication
- API request handling
- Error management and retry logic

## Web Dashboard Structure

### Components

**`InAppDashboard`**
- Main dashboard interface
- Call history and statistics
- Real-time data display

**`InAppCallScheduleSettings`**
- Schedule configuration
- Time and timezone management
- Relative-specific settings

**`DevicePairingManager`**
- Pairing code generation
- QR code creation
- Device management

**`PairedDevicesStatus`**
- Device status monitoring
- Pairing information display
- Device management controls

**`FamilyChatComponent`**
- Family chat interface
- Message display and sending
- Real-time updates

## Design System

### Color Palette
- **Primary**: `#E38B6F` (Warm Orange)
- **Text**: `#0F3B2E` (Dark Green)
- **Border**: `#E4B8AC` (Beige)
- **Background**: `#FFFFFF` (White)

### Typography
- **Font**: Fraunces (Google Fonts)
- **Sizes**: 12px - 32px
- **Weights**: 400, 500, 600, 700, 800

### UI Components
- Rounded corners (12px - 20px)
- Soft shadows and elevation
- High contrast for accessibility
- Large touch targets for elderly users

## Security Features

### Authentication
- Supabase authentication
- Anonymous user support for mobile
- Row Level Security (RLS) policies

### Data Protection
- Encrypted data transmission
- Secure token management
- Privacy-focused design

### Device Security
- Pairing token validation
- Device-specific authentication
- Secure API communication

## Performance Optimizations

### Mobile App
- Lazy loading of services
- Efficient image caching
- Optimized audio streaming
- Background task management

### Web Dashboard
- Real-time subscriptions
- Efficient data fetching
- Image optimization
- Responsive design

### Backend
- Edge function optimization
- Database query optimization
- Caching strategies
- Error handling and retry logic

## Deployment

### Mobile App
- **Android**: APK build with Flutter
- **iOS**: App Store deployment
- **Platforms**: Android 5.0+, iOS 12.0+

### Web Dashboard
- **Framework**: React + Vite
- **Hosting**: Vercel/Netlify
- **Domain**: Custom domain support

### Backend
- **Database**: Supabase PostgreSQL
- **Functions**: Supabase Edge Functions
- **CDN**: Global content delivery

## Monitoring and Analytics

### Call Analytics
- Call success rates
- Duration tracking
- Mood trend analysis
- Criteria evaluation scores

### System Monitoring
- Function execution logs
- Error tracking and reporting
- Performance metrics
- User engagement analytics

## Known Issues & Solutions

### ✅ Fixed: Type Casting Error in Event Stream (Release APK)

**Problem:**
- Release APK crashed with type casting error after ~3 seconds in call screen
- Error: `type '_Map<Object?, Object?>' is not a subtype of type 'Map<String, dynamic>?'`
- Location: `lib/services/elevenlabs_call_service.dart:44`
- Caused by native Kotlin bridge sending `Map<Object?, Object?>` while Dart expected `Map<String, dynamic>`

**Solution Applied:**
- Added comprehensive type conversion logic for nested event data maps
- Safely handles all Map types from native bridge: null, Map<String, dynamic>, and generic Map
- Conversational agent now works properly in release mode without exceptions
- Code location: `lib/services/elevenlabs_call_service.dart:45-55`

**Fixed in Version:** October 2025 release

### ✅ Fixed: iOS Bridge Alignment with Official ElevenLabs SDK

**Problem:**
- iOS bridge (`ElevenLabsBridge.swift`) not using official ElevenLabs Swift SDK
- Inconsistent functionality compared to Android bridge
- Missing proper conversation lifecycle management

**Solution Applied:**
- Refactored iOS bridge to use official `ElevenLabs.startConversation` API
- Aligned method channels and event channels with Android implementation
- Implemented proper conversation delegate methods
- Added VoIP token registration via MethodChannel
- Code location: `ios/Runner/ElevenLabsBridge.swift`

**Fixed in Version:** October 2025 release

### ✅ Enhanced: FCM Notification System

**Improvements:**
- Enhanced 2-phase notification scheduling (queue + execute)
- Improved device token detection from `device_pairs` and `push_notification_tokens`
- Added retry mechanism and error handling
- Real-time broadcasting to dashboard
- Platform-specific notification routing (Android FCM, iOS VoIP)

**Code Locations:**
- `supabase/functions/schedulerInAppCalls/`
- `supabase/functions/send-fcm-notification/`
- `supabase/functions/send-apns-voip-notification/`

**Enhanced in Version:** October 2025 release

## Future Enhancements

### Planned Features
- Video call support
- Multi-language support
- Advanced AI customization
- Health monitoring integration
- Emergency contact features

### Technical Improvements
- Offline mode support
- Advanced caching strategies
- Machine learning integration
- Enhanced accessibility features

## Support and Maintenance

### Documentation
- API documentation
- User guides
- Developer documentation
- Troubleshooting guides

### Updates
- Regular feature updates
- Security patches
- Performance improvements
- Bug fixes and optimizations

---

**Callpanion** - Keeping families connected through AI-powered conversations and shared memories. Built with love for elderly family members and their loved ones.
