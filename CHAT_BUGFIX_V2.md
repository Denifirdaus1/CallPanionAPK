# Chat Feature Bug Fix v2

## Problem
Button "Open Family Chat" tidak muncul di main screen karena `_householdId` bernilai `null`.

## Root Causes
1. **Wrong data source priority** - Query database dulu padahal household_id sudah disimpan di SharedPreferences saat pairing
2. **Wrong column name** - Query menggunakan `user_id` tapi seharusnya `elderly_user_id`

## Analysis
Saat user melakukan pairing device di `pairing_screen.dart`, household_id sudah disimpan:
```dart
await prefs.setString(AppConstants.keyHouseholdId, result['household_id'] ?? '');
```

Tapi `ChatService.getHouseholdId()` tidak menggunakan SharedPreferences sebagai sumber utama, malah query database yang kompleks dan error.

## Solution
Ubah strategi di `chat_service.dart` menjadi:
1. **Primary source**: Ambil dari SharedPreferences (tercepat dan selalu ada setelah pairing)
2. **Fallback**: Query database jika SharedPreferences kosong
3. **Cache**: Simpan hasil query database ke SharedPreferences untuk next time

### Changes Made:
```dart
// BEFORE - Query database first (SLOW & ERROR)
final devicePairs = await _supabase
    .from('device_pairs')
    .select('household_id')
    .eq('claimed_by', userId)  // might not match
    .limit(1);

// AFTER - Check SharedPreferences first (FAST & RELIABLE)
final householdId = prefs.getString(AppConstants.keyHouseholdId);
if (householdId != null && householdId.isNotEmpty) {
  return householdId; // ✅ Done!
}

// Then fallback to database if needed
// (dengan kolom yang benar: elderly_user_id)
```

## How to Apply Fix
```bash
# Hot reload (jika app sedang running)
r

# Atau hot restart
R

# Atau stop dan run ulang
flutter run -d <device>
```

## Expected Result After Fix
✅ **Log harus menunjukkan:**
```
I/flutter: [ChatService] ✅ Household ID from SharedPreferences: 87edadcb-3662-4ea6-a23f-4f62e74bb6a9
I/flutter: 📱 Household ID: 87edadcb-3662-4ea6-a23f-4f62e74bb6a9
```

✅ **Button "Open Family Chat"** muncul dengan warna hijau di main screen

## Why This Works
1. **SharedPreferences** adalah local storage yang pasti ada setelah pairing
2. **Tidak perlu query database** yang bisa lambat atau error
3. **household_id sudah disimpan** saat pairing di `pairing_screen.dart` line 56
4. **Faster and more reliable** - no network request, no query errors

## Testing
1. Hot reload app (`r` di terminal)
2. Cek log untuk confirm household_id ditemukan
3. Verify button "Open Family Chat" muncul
4. Tap button untuk buka chat screen
5. Test send message

## Files Modified
- `lib/services/chat_service.dart` - Updated `getHouseholdId()` method
