# Supabase Edge Functions Structure

This directory contains all the Edge Functions used by the CallPanion application.

## Notification Functions

- `send-fcm-notification` - Android FCM notifications
- `send-apns-voip-notification` - iOS APNS VoIP notifications
- `send-push-notification` - Universal push notifications

## ElevenLabs ConvAI WebRTC System

- `elevenlabs-webrtc-call` - Web WebRTC calls
- `elevenlabs-device-call` - Flutter device calls
- `voice-start` - Voice session start
- `voice-end` - Voice session end

## Scheduler Functions

- `schedulerDailyCalls` - Daily batch calls
- `schedulerInAppCalls` - In-App calls

Each function directory contains an `index.ts` file that implements the specific functionality.