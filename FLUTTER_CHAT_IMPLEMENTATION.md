# Flutter Chat Implementation - CallPanion Elderly

## Overview
Implementasi fitur chat realtime pada Flutter app CallPanion Elderly yang terintegrasi penuh dengan web dashboard. Chat menggunakan Supabase Realtime untuk komunikasi bidirectional antara elderly app dan family dashboard.

## Files Created

### 1. Model
- **`lib/models/chat_message.dart`** - Model data untuk chat message
- **`lib/models/chat_message.g.dart`** - Auto-generated serialization code

### 2. Service
- **`lib/services/chat_service.dart`** - Service layer untuk semua operasi chat:
  - `loadMessages()` - Load chat history
  - `subscribeToMessages()` - Subscribe ke realtime updates
  - `sendTextMessage()` - Kirim pesan teks
  - `uploadImage()` - Upload gambar ke Supabase Storage
  - `sendImageMessage()` - Kirim pesan gambar
  - `markAsRead()` - Mark pesan sebagai sudah dibaca
  - `pickImage()` - Pick gambar dari gallery
  - `getHouseholdId()` - Get household ID dari user

### 3. UI
- **`lib/screens/chat_screen.dart`** - Chat screen dengan fitur:
  - Message list dengan scroll auto ke bottom
  - Text input dengan dukungan multiline
  - Image picker dan preview
  - Image display dengan caching
  - Realtime message updates
  - Loading states
  - Error handling

### 4. Integration
- **`lib/screens/main_screen.dart`** - Updated dengan:
  - Import ChatService dan ChatScreen
  - State untuk `_householdId`
  - Method `_navigateToChat()`
  - Tombol "Open Family Chat" di UI
  - Auto-load household ID saat device paired

- **`lib/main.dart`** - Updated dengan:
  - Supabase initialization
  - Import supabase_flutter

- **`pubspec.yaml`** - Ditambahkan dependencies:
  - `supabase_flutter: ^2.10.2`
  - `image_picker: ^1.2.0`
  - `cached_network_image: ^3.4.1`
  - `intl: ^0.19.0`

## Database Schema
Menggunakan tabel `chat_messages` yang sudah ada di Supabase dengan struktur:
```sql
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY,
  household_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL,  -- 'family' or 'elderly'
  message TEXT,
  message_type TEXT NOT NULL,  -- 'text' or 'image'
  image_url TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);
```

## Storage
Menggunakan bucket `family-chat-media` untuk menyimpan gambar chat.

## Realtime Sync
- Channel: `family-chat-{householdId}`
- Event: INSERT pada tabel `chat_messages`
- Filter: `household_id = {householdId}`
- Auto-reconnection on network issues

## Features
1. ✅ Send text messages
2. ✅ Send image messages with optional caption
3. ✅ Receive messages realtime dari family dashboard
4. ✅ Load chat history
5. ✅ Image upload ke Supabase Storage
6. ✅ Image preview before sending
7. ✅ Cached image loading
8. ✅ Auto-scroll to bottom on new messages
9. ✅ Loading states dan error handling
10. ✅ Optimistic UI updates

## Testing Checklist
- [ ] Send text dari Flutter → muncul di web dashboard
- [ ] Send text dari web → muncul di Flutter app
- [ ] Send image dari Flutter → tampil di Flutter dan web
- [ ] Send image dari web → tampil di Flutter dan web
- [ ] Realtime sync bekerja di multiple devices
- [ ] Messages persist setelah app restart
- [ ] Error handling saat no internet
- [ ] Image upload dengan file size > 5MB ditolak
- [ ] Chat tetap berfungsi tanpa mengganggu sistem call existing

## Important Notes
1. **Tidak ada perubahan database** - Menggunakan schema yang sudah ada
2. **Tidak merusak sistem existing** - Call system tetap berfungsi normal
3. **Supabase credentials** - Sudah menggunakan credentials yang sama dengan web dashboard
4. **Sender type** - Flutter app mengirim sebagai `'elderly'`, web sebagai `'family'`
5. **Household ID** - Diambil dari `device_pairs` atau `relatives` table

## Build Commands
```bash
# Install dependencies
flutter pub get

# Generate .g.dart files
flutter packages pub run build_runner build --delete-conflicting-outputs

# Run app
flutter run -d <device>

# Build APK
flutter build apk --release
```

## Integration dengan Web Dashboard
Chat ini fully compatible dengan web dashboard di:
- `callpanion-web/src/services/ChatService.ts`
- `callpanion-web/src/components/FamilyChatComponent.tsx`
- `callpanion-web/src/pages/InAppDashboard.tsx`

Pesan dari Flutter app akan langsung muncul di web dashboard dan sebaliknya.
