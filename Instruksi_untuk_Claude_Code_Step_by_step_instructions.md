# 📋 Instruksi untuk Claude Code - Implementasi Native ElevenLabs ConvAI WebRTC

## 🎯 Konteks Project
Saya ingin mengimplementasikan sistem **Native ElevenLabs ConvAI WebRTC via Conversation Token + Supabase Edge Functions** untuk CallPanion project. Sistem ini akan menangani in-app calls dengan flow: Schedule → Cron Job → Push Notification → Native Call → ElevenLabs WebRTC → Webhook → Dashboard.

## 📁 Dokumen Referensi
Saya memiliki 2 dokumen guide yang harus kamu ikuti:
1. **ElevenLabs ConvAI WebRTC Implementation Guide** - Panduan teknis lengkap
2. **Tambahan Implementasi untuk Memastikan Sistem Berhasil 100%** - Komponen tambahan yang diperlukan

## 🔧 Yang Perlu Kamu Lakukan

### FASE 1: Analisis File Existing
Pertama, analyze semua file yang sudah ada di project:
```
- supabase/functions/elevenlabs-webrtc-call/
- supabase/functions/elevenlabs-device-call/
- supabase/functions/voice-start/
- supabase/functions/schedulerInAppCalls/
- supabase/functions/send-push-notification/
- elderly_app/lib/services/elevenlabs_call_service.dart
- elderly_app/ios/Runner/ElevenLabsBridge.swift
- elderly_app/android/.../ElevenLabsBridge.kt
- src/components/WebRTCCallInterface.tsx
```

### FASE 2: Update Supabase Edge Functions

#### 1. Update `elevenlabs-device-call/index.ts`
- Pastikan token generation menggunakan endpoint yang benar
- Tambahkan proper error handling
- Implement conversation tracking

#### 2. Create/Update `elevenlabs-webhook/index.ts`
```typescript
// Buat file baru ini jika belum ada
// Gunakan code dari "Tambahan Implementasi" section 1
// Pastikan webhook signature verification
// Handle semua event types: started, ended, error
```

#### 3. Update `schedulerInAppCalls/index.ts`
- Pastikan integration dengan push notification
- Add proper logging untuk debugging
- Implement retry mechanism

### FASE 3: Flutter Native Bridge Implementation

#### 4. Update iOS Bridge `ElevenLabsBridge.swift`
```swift
// Path: elderly_app/ios/Runner/ElevenLabsBridge.swift
// Gunakan code lengkap dari guide section "Native iOS implementation"
// Pastikan:
- Import ElevenLabsSDK properly
- Configure audio session
- Implement all handler methods
- Add CallKit integration
```

#### 5. Update Android Bridge `ElevenLabsBridge.kt`
```kotlin
// Path: elderly_app/android/app/src/main/kotlin/.../ElevenLabsBridge.kt
// Gunakan code dari guide section "Native Android implementation"
// Pastikan:
- Proper coroutine handling
- Error mapping
- Event streaming setup
```

#### 6. Update Flutter Service
```dart
// Path: elderly_app/lib/services/elevenlabs_call_service.dart
// Update dengan:
- Method channel communication
- Event channel for real-time updates
- Proper error handling
- Permission management
```

### FASE 4: Web Dashboard Integration

#### 7. Update `WebRTCCallInterface.tsx`
- Implement conversation token usage
- Add real-time status updates
- Handle call completion

#### 8. Create Real-time Hook
```typescript
// Create new: src/hooks/useRealtimeCallUpdates.ts
// Gunakan code dari "Tambahan Implementasi" section 2
```

### FASE 5: Database & Configuration

#### 9. Database Migrations
```sql
-- Jalankan migrations untuk memastikan tables exist:
- conversations
- conversation_events
- call_logs
- call_summaries
-- Dengan proper RLS policies
```

#### 10. Environment Variables
```bash
# Update .env.local dan Supabase secrets:
ELEVENLABS_API_KEY=
ELEVEN_AGENT_ID_IN_APP=
ELEVENLABS_WEBHOOK_SECRET=
FCM_SERVICE_ACCOUNT_KEY=
APNS_KEY_ID=
APNS_TEAM_ID=
```

### FASE 6: Testing & Verification

#### 11. Create Test Script
```typescript
// Create: test/test-complete-flow.ts
// Gunakan code dari "Tambahan Implementasi" section 6
// Test setiap step dari flow
```

## ⚠️ PENTING - Urutan Eksekusi

**JANGAN update semua file sekaligus!** Ikuti urutan ini:

1. **START**: Analyze existing code first
2. **Backend First**: Update Edge Functions (1-3)
3. **Test Backend**: Pastikan token generation works
4. **Mobile Bridge**: Update iOS & Android (4-5)
5. **Flutter Integration**: Update Flutter service (6)
6. **Web Updates**: Update dashboard (7-8)
7. **Database**: Run migrations (9)
8. **Config**: Set environment variables (10)
9. **Test**: Run complete flow test (11)

## 🔍 Validation Checklist

Setelah setiap update, validate:
- [ ] Code compiles without errors
- [ ] No TypeScript/Dart/Swift/Kotlin errors
- [ ] Edge Functions deploy successfully
- [ ] Flutter app builds for both platforms
- [ ] Push notifications received
- [ ] WebRTC connection established
- [ ] Webhook data processed
- [ ] Dashboard updates real-time

## 📝 Expected Output

Setelah implementasi selesai, sistem harus bisa:
1. Schedule in-app call dari web dashboard ✓
2. Cron job pick up dan send push notification ✓
3. User terima notification dan accept call ✓
4. Native ElevenLabs SDK start WebRTC session ✓
5. User bisa bicara dengan AI ✓
6. Webhook capture call data ✓
7. Dashboard show real-time updates dan summaries ✓

## 🆘 Jika Ada Error

Jika menemui error saat implementasi:
1. Check Supabase Edge Function logs
2. Check Flutter debug console
3. Verify environment variables
4. Test dengan flow yang lebih simple dulu
5. Pastikan semua dependencies installed

## 💡 Tips untuk Claude Code

- Gunakan `git diff` untuk review changes
- Test setiap component individually
- Keep backup of working code
- Comment code changes untuk tracking
- Use proper error messages untuk debugging

---

**MULAI DARI**: Analyze existing `elevenlabs-device-call/index.ts` dan bandingkan dengan guide untuk identify gaps yang perlu di-update.