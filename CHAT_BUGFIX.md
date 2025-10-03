# Chat Feature Bug Fix

## Problem
Button "Open Family Chat" tidak muncul di main screen karena `_householdId` bernilai `null`.

## Root Cause
Query di `ChatService.getHouseholdId()` menggunakan kolom yang salah:
- **Error Query**: `SELECT household_id FROM relatives WHERE user_id = ?`
- **Problem**: Kolom `user_id` tidak ada di tabel `relatives`
- **Correct Column**: `elderly_user_id`

## Database Schema
Berdasarkan `ShemaDBpublic.MD`, tabel `relatives` memiliki struktur:
- `id` (UUID, primary key)
- `household_id` (UUID) ← yang kita butuhkan
- `elderly_user_id` (UUID) ← kolom yang benar untuk match dengan user ID
- Dan kolom lainnya...

## Solution
Updated query di `chat_service.dart` line 337:
```dart
// BEFORE (WRONG):
.eq('user_id', userId)

// AFTER (CORRECT):
.eq('elderly_user_id', userId)
```

## Steps to Fix
1. ✅ Edit `lib/services/chat_service.dart` - ganti `user_id` menjadi `elderly_user_id`
2. ⏳ Hot reload atau restart app
3. ⏳ Verify button muncul di main screen
4. ⏳ Test buka chat screen

## Testing After Fix
Setelah restart app, cek di log:
```
I/flutter: [ChatService] Household ID from device_pairs: <uuid>
I/flutter: 📱 Household ID: <uuid>  ← HARUS ADA VALUE, BUKAN NULL!
```

Jika sudah muncul household ID, maka button "Open Family Chat" akan muncul di main screen.

## How to Apply Fix
```bash
# Hot reload (jika app sedang running)
r

# Atau restart app
R

# Atau stop dan run ulang
flutter run -d <device>
```

## Expected Result
- ✅ Household ID berhasil di-load dari database
- ✅ Button "Open Family Chat" muncul di main screen
- ✅ Chat screen dapat dibuka
- ✅ Pesan dapat dikirim dan diterima
