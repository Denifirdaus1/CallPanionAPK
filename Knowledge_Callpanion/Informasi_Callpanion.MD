A.jadi aku tuh lagi buat saas project bernama Callpanion , yang konsepnya itu simple sih menelepon orangtua dengan ai agent elevenlasb untuk menanyai kabar mereka dan mengobrol santai terus nanti hasil call nya ditampilkan di dashboard keluarga yang sudah di summry jadi tinggal ambil di webhook aja , untuk sistemnya kita ada 2 :
1.batch call , nah untuk bath call ini sistemnya simple karena kita pakai fitur batch call nya elevenlabs, jadi cukup kita kirim aja request call dan waktu shejule nya baru nanti di eksekusi sama cron job dan call nya langsung masuk ke nomor tlp orangtua dengan twilio juga untuk nomor tlp ai nya dan nanti hasil nya di webhook terus di tampilkan di dashboard keluarga khusus metode batch call , dan sebagai informasi juga nih jadi si dashboard nya ada 2 dan disesuaikan sama apa yang dipilih di onboarding saat awal signup.
2.in app call , nah ini sistemya lebih kompleks karena kita mengintegrasikan dashboard web untuk opsi in app call dengan apk flutter kita ini , dan ini list fungsi dari web dan apk nya :
WEB:
a.untuk keluarga login/signup dan membuat akun awal yang disesuaikan dengan opsi pilihan in app call dan batch call 
b.membuat shejule jadwal call 3 kali sehari di set sesuai time zone yang dipilih dan terhubung dengan setiap edge funcions yang nantinya di eksekusi oleh corn job dan sitem corn jobnya itu akan menambahkan call hejule ke antrian 5 menit sebelum Waktu eksekusi notifikasi terkirim , dan untuk system notifikasinya itu menyesuaikan sama device yang diapake orangtua nya , kalo ios berarti pakai VOIP dan kalua anroid itu pakai FCM.
c.melakuakan device pairing dengan generated 6 digit token yang nnatinya dimasukan ke apk orangtua agar terhubung anatara orangtua dan keluarga 
d.menampilkan device pairing status
e.menampilkan Riwayat recent call 
f.menampilkan call summary

NATIVE APK FLUTTER:
a.menerima notifikasi sesuai call shejule yang sudah disesuai dengan device nya apakah android atau ios nya.
b.stelah menerima notifikasi call dan user menekan tombol accept call langsung terhubung dengan elevenlabs conversational call dengan request conversational token dan hasilnya di webhook dengan edge funcions yang sama yang dipakai juga oleh batch call dan dibedakan denngan call id antara in app call atau batch call dan dikirim ke dashoard keluarga yang tepat 
c.memasukan device pairing token untuk terhubug dengan in app call

B.dan ini path Bridges nya :
1.Android bridge ke ElevenLabs SDK
C:\CallPanionAPK\android\app\src\main\kotlin\app\lovable\a4b57244d3ad47ea85cac99941e17d30\ElevenLabsBridge.kt
2.iOS bridge ke ElevenLabs SDK:
C:\CallPanionAPK\ios\Runner\ElevenLabsBridge.swift

C.dan ini Frontend React Components (Web) C:\CallPanionAPK\callpanion-web:
C:\CallPanionAPK\callpanion-web\src\pages\InAppDashboard.tsx - Dashboard utama 
C:\CallPanionAPK\callpanion-web\src\components\InAppCallMonitor.tsx - Monitor real-time status panggilan aktif dan history
C:\CallPanionAPK\callpanion-web\src\components\InAppCallScheduleManager.tsx - Mengelola jadwal sesi panggilan in-app
C:\CallPanionAPK\callpanion-web\src\components\InAppCallScheduleSettings.tsx - Pengaturan jadwal panggilan
C:\CallPanionAPK\callpanion-web\src\components\InAppCallSummaryViewer.tsx - Melihat ringkasan hasil panggilan
C:\CallPanionAPK\callpanion-web\src\components\DevicePairingManager.tsx - Generate token pairing untuk menghubungkan perangkat elderly
C:\CallPanionAPK\callpanion-web\src\components\PairedDevicesStatus.tsx - Monitor status perangkat yang sudah dipasangkan
C:\CallPanionAPK\callpanion-web\src\components\ConversationInsightsDashboard.tsx - AI insights dari percakapan
React Hooks & Utilities
useCallMethodAccess.ts - Hook untuk cek akses metode panggilan (batch vs in-app)
useRealtimeUpdates.ts - Hook untuk real-time updates call logs & sessions

D.Edge Functions (Backend Logic)
supabase/functions/elevenlabs-device-call/index.ts - Manage ElevenLabs WebRTC calls
supabase/functions/schedulerInAppCalls/index.ts - Scheduler untuk in-app calls
supabase/functions/send-fcm-notification/index.ts - Send Android push notifications
supabase/functions/send-apns-voip-notification/index.ts - Send iOS VoIP notifications
supabase/functions/pair-init/index.ts - Initialize device pairing
supabase/functions/pair-claim/index.ts - Claim pairing tokens
supabase/functions/register-fcm-token/index.ts - Register device FCM tokens
supabase/functions/device-heartbeat/index.ts - Device health monitoring
supabase/functions/updateCallStatus/index.ts - Update call status in database