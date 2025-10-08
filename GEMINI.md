# Gemini Knowledge Base: Callpanion Project

This document summarizes my understanding of the Callpanion project based on the provided `README.md` file.

## 1. Project Overview

Callpanion is an AI-powered communication platform designed for elderly family members to stay connected with their families. It integrates real-time AI voice conversations, family chat, and photo sharing. The user interface is designed to be elderly-friendly with large fonts, high contrast, and simple navigation.

- **Primary Users**: Elderly family members and their families.
- **Core Goal**: Keep families connected across distances.

## 2. Technology Stack

The project uses a modern, cross-platform technology stack.

- **Mobile App (Frontend)**: Flutter (Dart)
- **Web Dashboard (Frontend)**: React with TypeScript and Vite.
- **Backend**: Supabase (PostgreSQL Database, Authentication, Edge Functions).
- **AI Voice**: ElevenLabs.
- **Push Notifications**: Firebase Cloud Messaging (FCM) for Android and Apple Push Notification Service (APNS) for iOS (VoIP).
- **Typography**: Google Fonts (Fraunces).

## 3. System Architecture

The system is divided into a mobile application for the elderly user, a web dashboard for family members, and a Supabase backend that orchestrates everything.

### Key Workflows:

1.  **Scheduling**: Family members use the web dashboard to set call schedules (morning, afternoon, evening) for their relatives in different timezones.
2.  **Device Pairing**: The mobile app is paired with a relative's profile using a 6-digit code or a QR code generated from the web dashboard.
3.  **Notifications**: Supabase Edge Functions trigger scheduled notifications (FCM for Android, VoIP/CallKit for iOS) to initiate calls.
4.  **AI Calls**: The Flutter app handles incoming call notifications (using CallKit for the native iOS UI) and connects to ElevenLabs for the real-time AI voice conversation via a WebRTC connection.
5.  **Data Collection**: A Supabase Edge Function (`elevenlabs-webhook`) receives post-call data from ElevenLabs, including summaries, transcripts, and sentiment analysis, and stores it in the database.
6.  **Dashboard**: The React web dashboard displays call history, AI-generated summaries, mood trends, and allows for family chat.

### Database Schema

The core tables in the Supabase PostgreSQL database include:

- `households`: Family groups.
- `relatives`: Individual family members.
- `device_pairs`: Information about paired mobile devices.
- `call_schedules`: Call timing configurations.
- `call_logs`: Records of individual calls.
- `call_summaries`: AI-generated analysis of calls.
- `chat_messages`: Family chat history.

## 4. Application Structure

### Mobile App (Flutter)

- **Screens**: `MainScreen`, `PairingScreen`, `CallScreen`, `ChatScreen`, `GalleryScreen`.
- **Services**: `CallKitService`, `ElevenLabsCallService`, `ChatService`, `ApiService` for handling core functionalities.

### Web Dashboard (React)

- **Components**: `InAppDashboard`, `InAppCallScheduleSettings`, `DevicePairingManager`, `FamilyChatComponent`.
- **Purpose**: Configuration, monitoring, and interaction for family members.

## 5. Security & Performance

- **Security**: Authentication is handled by Supabase with Row Level Security (RLS). Data is encrypted, and pairing tokens are managed securely.
- **Performance**: The system uses lazy loading, efficient caching, optimized audio streaming, and real-time database subscriptions to ensure a responsive experience.

## 6. My Role

My purpose is to assist in the development and maintenance of the Callpanion project. I can help with:

- Understanding and explaining the codebase.
- Implementing new features and fixing bugs.
- Writing and refactoring code in Dart (Flutter), TypeScript (React), and for Supabase Edge Functions.
- Analyzing and working with the database schema.
- Following the established architecture and design patterns.
