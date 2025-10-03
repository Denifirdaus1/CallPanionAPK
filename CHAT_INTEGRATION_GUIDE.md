# Flutter Chat Integration Guide

## Overview

This guide explains how to integrate real-time chat functionality in the Flutter elderly app to sync with the family web dashboard chat feature. Your agent will implement the code based on these specifications.

---

## 1. Database Schema

### Table: `chat_messages`

Already exists in Supabase with the following structure:

```sql
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL,  -- 'family' or 'elderly'
  message TEXT,               -- nullable for image-only messages
  message_type TEXT NOT NULL DEFAULT 'text',  -- 'text' or 'image'
  image_url TEXT,             -- nullable, used when message_type = 'image'
  read_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### RLS Policy

**Access Control:**
- Users can only access messages from households they belong to
- Enforced via `household_members` table join

```sql
Policy: chat_messages_household_access
  household_id IN (
    SELECT household_id 
    FROM household_members 
    WHERE user_id = auth.uid()
  )
```

---

## 2. Storage Bucket: `family-chat-media`

### Bucket Configuration
- **Name:** `family-chat-media`
- **Public:** Yes (images accessible via signed URLs)
- **File Types:** jpg, jpeg, png, gif, webp
- **Max File Size:** 5MB
- **Folder Structure:** `{household_id}/{timestamp}.{ext}`

### RLS Policies on `storage.objects`
- Users can upload to their household folder
- Users can view images from their household
- Service role has full access

---

## 3. Real-time Sync Mechanism

### How Sync Works

1. **Supabase Realtime** broadcasts PostgreSQL changes via WebSocket
2. Listen to `INSERT` events on `chat_messages` table
3. Filter by `household_id` to receive only relevant messages
4. Update UI automatically when new messages arrive

### Key Points
- WebSocket connection: `wss://umjtepmdwfyfhdzbkyli.supabase.co/realtime/v1/websocket`
- Channel name format: `chat:{household_id}`
- Event type: `postgres_changes` with `INSERT` filter
- Auto-reconnection on network issues

---

## 4. Required Flutter Dependencies

### Latest Versions (as of 2025)

Add to `pubspec.yaml`:

```yaml
dependencies:
  # Supabase client with realtime support
  supabase_flutter: ^2.10.2
  
  # Image picker for selecting photos
  image_picker: ^1.2.0
  
  # Cached network image for efficient image loading
  cached_network_image: ^3.4.1
```

---

## 5. Core Features to Implement

Your agent should implement these features in the Flutter app:

### A. Message Loading
- **Query:** `SELECT * FROM chat_messages WHERE household_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`
- **Purpose:** Load chat history on screen open
- **Note:** Filter out soft-deleted messages

### B. Real-time Message Subscription
- **Channel:** `chat:{household_id}`
- **Listen to:** `INSERT` events on `chat_messages` table
- **Filter:** `household_id` column
- **Action:** Append new message to UI list, scroll to bottom

### C. Send Text Message
- **Table:** `chat_messages`
- **Fields to insert:**
  - `household_id`: from user context
  - `sender_id`: from `auth.currentUser.id`
  - `sender_type`: `'elderly'`
  - `message`: text content
  - `message_type`: `'text'`

### D. Send Image Message
**Step 1: Upload to Storage**
- **Bucket:** `family-chat-media`
- **Path:** `{household_id}/{timestamp}.{ext}`
- **Method:** `storage.from('family-chat-media').upload(path, file)`

**Step 2: Get Signed URL**
- **Method:** `storage.from('family-chat-media').createSignedUrl(path, 31536000)`
- **Expiry:** 1 year (31536000 seconds)

**Step 3: Insert Message Record**
- Same as text message but:
  - `message_type`: `'image'`
  - `image_url`: signed URL from Step 2
  - `message`: optional caption

### E. Mark as Read (Optional)
- **Update:** `UPDATE chat_messages SET read_at = NOW() WHERE id = ?`
- **When:** Message viewed by recipient

---

## 6. Sync Flow Diagram

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Flutter App    │         │   Supabase DB    │         │   Web Dashboard │
│   (Elderly)     │         │                  │         │   (Family)      │
└────────┬────────┘         └────────┬─────────┘         └────────┬────────┘
         │                           │                            │
         │ 1. Open chat screen       │                            │
         ├──────────────────────────>│                            │
         │ Load messages (SELECT)    │                            │
         │<──────────────────────────┤                            │
         │                           │                            │
         │ 2. Subscribe to realtime  │                            │
         ├──────────────────────────>│                            │
         │ WebSocket connection      │                            │
         │<──────────────────────────┤                            │
         │                           │                            │
         │                           │ 3. Family sends message    │
         │                           │<───────────────────────────┤
         │                           │ INSERT into chat_messages  │
         │                           │                            │
         │ 4. Realtime notification  │                            │
         │<──────────────────────────┤                            │
         │ New message payload       │                            │
         │                           │                            │
         │ 5. Update UI              │                            │
         │ Append to chat list       │                            │
         │                           │                            │
         │ 6. Elderly sends reply    │                            │
         ├──────────────────────────>│                            │
         │ INSERT into chat_messages │                            │
         │                           │                            │
         │                           │ 7. Realtime notification   │
         │                           ├───────────────────────────>│
         │                           │ New message payload        │
         │                           │                            │
         │                           │ 8. Web dashboard updates   │
         │                           │                            │
```

---

## 7. Authentication Context

### Getting household_id

The elderly user needs to be linked to a household. Two methods:

**Method 1: Via device_pairs table**
```sql
SELECT household_id, relative_id 
FROM device_pairs 
WHERE claimed_by = auth.uid() 
  AND claimed_at IS NOT NULL
LIMIT 1;
```

**Method 2: Via relatives table** (if user is directly linked)
```sql
SELECT household_id, id as relative_id
FROM relatives
WHERE user_id = auth.uid()
LIMIT 1;
```

### Authentication Flow
1. User must be authenticated via Supabase Auth
2. Get `auth.uid()` from current session
3. Query `household_id` using one of the methods above
4. Store in app state/memory for chat access

---

## 8. Implementation Checklist

- [ ] Add dependencies to `pubspec.yaml`
- [ ] Initialize Supabase client in `main.dart`
- [ ] Create `ChatMessage` model class
- [ ] Implement `ChatService` with methods:
  - [ ] `loadMessages(householdId)`
  - [ ] `subscribeToMessages(householdId)` 
  - [ ] `sendTextMessage(householdId, message)`
  - [ ] `uploadImage(householdId, filePath)`
  - [ ] `sendImageMessage(householdId, imageUrl, caption?)`
  - [ ] `markAsRead(messageId)`
  - [ ] `dispose()` - cleanup realtime subscription
- [ ] Create chat screen UI with:
  - [ ] Message list (ListView.builder)
  - [ ] Text input field
  - [ ] Send button
  - [ ] Image picker button
  - [ ] Auto-scroll to bottom on new message
  - [ ] Loading states
- [ ] Handle authentication state
- [ ] Test realtime sync with web dashboard

---

## 9. Testing Checklist

### Real-time Sync Tests
- [ ] Send text message from Flutter → appears in web dashboard
- [ ] Send text message from web → appears in Flutter app
- [ ] Send image from Flutter → displays in both Flutter and web
- [ ] Send image from web → displays in both Flutter and web
- [ ] Multiple devices receive messages simultaneously
- [ ] Messages persist after app restart

### Error Handling Tests
- [ ] No internet connection → graceful error message
- [ ] Authentication expired → prompt re-login
- [ ] Image upload failure → retry or skip
- [ ] Realtime connection lost → auto-reconnect

---

## 10. Troubleshooting

### Messages Not Appearing

**Check:**
1. User authentication: `Supabase.instance.client.auth.currentUser`
2. Correct `household_id` being used
3. RLS policies allow access (verify in Supabase dashboard)
4. WebSocket connection status (should be `SUBSCRIBED`)

**Debug:**
```dart
print('User ID: ${Supabase.instance.client.auth.currentUser?.id}');
print('Household ID: $householdId');
print('Channel status: ${_channel?.status}');
```

### Images Not Uploading

**Check:**
1. Storage bucket `family-chat-media` exists and is public
2. File size under 5MB
3. File path is correct (use absolute path)
4. User has upload permission

**Debug:**
```dart
try {
  final result = await supabase.storage
    .from('family-chat-media')
    .upload(fileName, file);
  print('Upload result: $result');
} catch (e) {
  print('Upload error: $e');
}
```

### Real-time Not Working

**Check:**
1. Internet connection active
2. Realtime enabled in Supabase project settings
3. Correct channel subscription syntax
4. Filter matches `household_id` exactly

**Debug:**
```dart
_channel = supabase.channel('chat:$householdId')
  .onPostgresChanges(
    event: PostgresChangeEvent.insert,
    schema: 'public',
    table: 'chat_messages',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'household_id',
      value: householdId,
    ),
    callback: (payload) {
      print('Received payload: $payload');
      // Process message
    },
  )
  .subscribe((status) => print('Subscription status: $status'));
```

---

## 11. Security Considerations

1. **Authentication Required:** All chat operations require valid Supabase auth session
2. **Household Scope:** Users can only access messages from their household via RLS
3. **RLS Enforcement:** Database policies prevent unauthorized access
4. **Signed URLs:** Images use time-limited signed URLs (1 year expiry)
5. **No Client-side Secrets:** All sensitive operations handled by Supabase client library

---

## 12. Performance Optimization Tips

1. **Message Pagination:** Load recent 50-100 messages first, implement "load more" for older messages
2. **Image Caching:** Use `cached_network_image` to avoid re-downloading
3. **Lazy Loading:** Don't load images until scrolled into view
4. **Connection Pooling:** Reuse single Supabase client instance across app
5. **Debounce Typing:** Wait 300ms before marking as "typing" to reduce API calls

---

## 13. API Endpoints Reference

### Supabase Project
- **Project URL:** `https://umjtepmdwfyfhdzbkyli.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE`

### Initialize in Flutter
```dart
await Supabase.initialize(
  url: 'https://umjtepmdwfyfhdzbkyli.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
);
```

---

## Summary

This integration enables **bidirectional real-time chat** between:
- Flutter elderly app (sender_type: `'elderly'`)
- Web family dashboard (sender_type: `'family'`)

**Key Technologies:**
- PostgreSQL for message storage
- Supabase Realtime for WebSocket sync
- Supabase Storage for image hosting
- RLS for security

**Your agent should implement:**
1. ChatService class with all CRUD operations
2. Chat screen UI with message list and input
3. Real-time subscription management
4. Image upload and display
5. Authentication state handling

All backend infrastructure (database, storage, realtime) is already configured and ready to use.
