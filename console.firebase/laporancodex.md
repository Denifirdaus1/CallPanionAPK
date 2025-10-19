Berikut hasil analisis mendalam alur FCM dan akar masalahnya, beserta rekomendasi       
  perbaikan cepat.                                                                        
                                                                                          
  Ringkasan                                                                               
                                                                                          
  - Akar masalah: Edge Function send-fcm-notification gagal saat mengambil OAuth          
  token Google dengan error “Invalid JWT Signature” → hampir pasti karena secret          
  FCM_SERVICE_ACCOUNT_JSON tidak valid/mismatch/terkorupsi (terutama pasangan client_email
  dan private_key), atau key telah dicabut/rotated tanpa update di Supabase.              
  - Dampak: Semua pengiriman FCM via send-fcm-notification dan send-push-notification     
  gagal di tahap OAuth (sebelum request dikirim ke endpoint FCM), sehingga scheduler      
  (schedulerInAppCalls) melaporkan “Edge Function returned a non-2xx status code”.        
  - Kode Flutter dan Web di sisi pairing/registrasi token tampak benar. Ada risiko        
  tambahan di Android terkait channel notifikasi (“callpanion_calls”) namun itu bukan     
  penyebab error sekarang (server-side fail terlebih dulu).                               
                                                                                          
  Alur Sistem (disingkat)                                                                 
                                                                                          
  - Web pairing menghasilkan token di device_pairs, dipakai untuk pairing di app.         
      - callpanion-web/src/components/DevicePairingManager.tsx:78 dan :119                
  - App (Flutter) klaim pairing → auth Supabase anon → re-register FCM token.             
      - lib/screens/pairing_screen.dart:68 (re-register token)                            
      - lib/services/fcm_service.dart:83 (handler background), :151 (registerToken), :186 
  (onTokenRefresh)                                                                        
      - lib/services/api_service.dart:23 (registerFCMToken)                               
  - Edge function register-fcm-token menyimpan token ke push_notification_tokens dan      
  update device_pairs.device_info.fcm_token.                                              
  - Scheduler (schedulerInAppCalls) ambil jadwal → cari token di device_pairs → invoke    
  send-fcm-notification (atau APNS VoIP iOS).                                             
      - supabase/functions/schedulerInAppCalls/index.ts:316 (APNS), :321 (FCM), :481 (log 
  execute error)                                                                          
  - Pengiriman notifikasi:                                                                
      - supabase/functions/send-fcm-notification/index.ts:5 (baca secret), :19 (OAuth     
  fetch), :51 (buat JWT), :209 (FCM endpoint)                                             
      - supabase/functions/send-push-notification/index.ts:5 (baca secret), :23 (OAuth    
  fetch), :335 (FCM endpoint)                                                             
                                                                                          
  Bukti/Temuan dari Log                                                                   
                                                                                          
  - Gagal sekarang:                                                                       
      - Error: “OAuth failed: Invalid JWT Signature.” saat getAccessToken() di send-fcm-  
  notification.                                                                           
      - Ini artinya signature JWT yang dikirim ke OAuth endpoint Google tidak dapat       
  diverifikasi → paling sering terjadi karena private key tidak cocok dengan client_email 
  (mismatch), key rusak, atau key sudah dicabut/rotated.                                  
      - Log yang Anda kirim cocok: HTTP 500 dari edge function, diikuti                   
  schedulerInAppCalls melaporkan “Edge Function returned a non-2xx status code”.          
  - Pernah sukses sebelumnya:                                                             
      - Sebelumnya token diambil sukses, request FCM terkirim dan dapat name:             
  "projects/.../messages/..." (artinya flow benar saat itu).                              
  - Perubahan versi:                                                                      
      - Sukses di deployment version 129, gagal di 151 → indikasi kuat ada perubahan      
  secret/env di Supabase atau re-deploy fungsi mengambil secret yang sudah berubah.       
                                                                                          
  Analisis Akar Masalah                                                                   
                                                                                          
  - Secret FCM_SERVICE_ACCOUNT_JSON sangat mungkin:                                       
      - Tidak sesuai dengan project FCM (project_id tidak match).                         
      - Memuat client_email dan private_key dari service account yang berbeda (tercampur).      - Private key dicabut/expired/rotated dengan key baru namun secret di Supabase belum
  di-update.                                                                              
      - Private key string terkorupsi (karakter hilang/bertambah) sehingga signature      
  invalid.                                                                                
  - Kode JWT generator di dua fungsi (send-fcm-notification dan send-push-notification)   
  secara prinsip benar: header/payload base64url, sign RSASSA-PKCS1-v1_5 SHA-256, aud ke  
  https://oauth2.googleapis.com/token. Jika secret valid, ini bekerja (terbukti dari log  
  sukses sebelumnya).                                                                     
                                                                                          
  Pemeriksaan Sisi Aplikasi (bukan penyebab utama saat ini, tapi penting)                 
                                                                                          
  - Flutter FCM:                                                                          
      - Token direfresh dan di-register ulang sudah ada (lib/services/                    
  fcm_service.dart:186).                                                                  
      - Register token menyertakan pairing info, update ke                                
  device_pairs.device_info.fcm_token (validasi rute data ok).                             
  - Android Notifikasi Channel:                                                           
      - Server menyetel android.notification.channel_id: 'callpanion_calls' saat kirim    
  notifikasi.                                                                             
      - AndroidManifest sudah set default channel id callpanion_calls (android/app/src/   
  main/AndroidManifest.xml:111).                                                          
      - Perlu pastikan channel callpanion_calls benar-benar dibuat (melalui               
  FlutterLocalNotifications atau native). Kalau channel tidak ada, notifikasi bisa tidak  
  tampil di Android 8+. Saat ini ada channel untuk chat (chat_messages), tetapi tidak     
  terlihat pembuatan eksplisit untuk callpanion_calls. Ini perlu ditindaklanjuti, namun   
  bukan sumber error “Invalid JWT Signature”.                                             
  - Android 13+ permission POST_NOTIFICATIONS:                                            
      - Sudah ada di manifest (android/app/src/main/AndroidManifest.xml:6).               
      - Di Flutter, tidak ada permintaan permission eksplisit Android                     
  (FirebaseMessaging.requestPermission() hanya iOS). Biasanya FCM tetap bisa tampil jika  
  user memberi izin; namun untuk kepastian UX lebih baik pakai package permission_handler 
  atau pengaturan awal untuk meminta izin. Lagi-lagi ini bukan penyebab error server saat 
  ini.                                                                                    
                                                                                          
  Rekomendasi Perbaikan Cepat                                                             
                                                                                          
  - Validasi dan perbarui secret FCM_SERVICE_ACCOUNT_JSON:                                
      1. Di Supabase Dashboard → Project Settings → Functions → Secrets, cek              
  FCM_SERVICE_ACCOUNT_JSON.                                                               
      2. Pastikan isinya persis JSON service account yang Anda download dari Google Cloud 
  (IAM & Admin → Service Accounts → Keys → Create new key). Jangan ada edit manual.       
      3. Pastikan project_id cocok dengan project FCM Anda (mis. callpanion-46b76) dan    
  client_email sesuai service account yang benar.                                         
      4. Pastikan private_key adalah PKCS#8 “-----BEGIN PRIVATE KEY----- ... -----END     
  PRIVATE KEY-----” yang masih aktif dan milik service account yang sama.                 
      5. Simpan secret, lalu redeploy fungsi atau trigger kembali fungsi agar runtime     
  memuat secret terbaru.                                                                  
  - Uji cepat:                                                                            
      - Invoke send-fcm-notification dengan payload minimal (pakai deviceToken valid) dari
  Supabase Functions UI. Jika OAuth sukses, Anda akan lihat messageId FCM atau error FCM  
  lain seperti “NotRegistered” (yang menandakan token device problem, tapi OAuth sudah    
  ok).                                                                                    
  - Jika Anda baru saja rotate key:                                                       
      - Hapus key lama di Google Cloud agar tidak ada kebingungan.                        
      - Simpan kembali key baru ke Supabase secret.                                       
  - Cek konsistensi di semua fungsi:                                                      
      - send-push-notification juga memakai secret yang sama; setelah update secret, uji  
  fungsi ini juga (karena scheduler menggunakannya untuk notifikasi ke anggota keluarga). 
                                                                                          
  Hardening yang Disarankan                                                               
                                                                                          
  - Validasi secret di cold start:                                                        
      - Tambahkan pengecekan awal yang log “fingerprint” pendek (hash beberapa karakter)  
  dari client_email dan private_key_id untuk mendeteksi mismatch tanpa membocorkan secret.  - Tangani dua format kunci:                                                             
      - Jika suatu saat private key berformat “-----BEGIN RSA PRIVATE KEY-----” (PKCS#1), 
  siapkan fallback konversi/handling (opsional jika seluruh key Anda PKCS#8).             
  - Logging yang lebih informatif untuk OAuth:                                            
      - Saat gagal OAuth, log field non-sensitif: iss (client_email), project_id, length  
  private_key (bukan isi), supaya diagnosis cepat saat kejadian serupa.                   
  - Kanal Android:                                                                        
      - Buat channel callpanion_calls via FlutterLocalNotifications saat app init (serupa 
  dengan chat_messages) agar notifikasi panggilan tidak drop di Android 8+. Anda bisa     
  meniru pola di lib/services/chat_notification_service.dart:40 untuk membuat channel     
  “callpanion_calls”.                                                                     
                                                                                          
  Checklist Verifikasi                                                                    
                                                                                          
  - Supabase:                                                                             
      - Secret FCM_SERVICE_ACCOUNT_JSON sesuai (client_email, project_id, private_key     
  konsisten).                                                                             
      - Deploy Edge Functions ulang.                                                      
      - Invoke send-fcm-notification dan send-push-notification secara manual dan cek 2   
  hal: OAuth success (tidak ada “Invalid JWT Signature”) dan response FCM berisi name:    
  "projects/.../messages/...".                                                            
  - Database:                                                                             
      - Periksa device_pairs untuk relative target apakah device_info.fcm_token terisi.   
      - Jika kosong, cek fungsi register-fcm-token dan arus pairing ulang di perangkat.   
  - Perangkat:                                                                            
      - Pastikan app sudah meminta izin notifikasi (Android 13+), channel callpanion_calls
  ada, dan device benar-benar menerima notifikasi test (notifikasi biasa/general terlebih 
  dulu).                                                                                  
  - Scheduler:                                                                            
      - Jalankan schedulerInAppCalls, pastikan tidak ada lagi error “Edge Function        
  returned a non-2xx status code”.                                                        
                                                                                          
  Catatan Tambahan Terkait Kode                                                           
                                                                                          
  - send-fcm-notification melakukan validasi bahwa deviceToken cocok dengan device_pairs  
  household terkait sebelum mengirim (aman dan benar).                                    
      - supabase/functions/send-fcm-notification/index.ts:5, :19, :51, :209               
  - schedulerInAppCalls menggunakan token dari device_pairs dan fallback ke               
  push_notification_tokens jika perlu, lalu invoke fungsi pengirim (sesuai desain).       
      - supabase/functions/schedulerInAppCalls/index.ts:316, :321, :481                   
  - FCMService (Flutter) sudah mengelola background/foreground handler dan re-register    
  token on refresh (baik).                                                                
      - lib/services/fcm_service.dart:83, :151, :186                                      
  - Android Manifest sudah memuat POST_NOTIFICATIONS dan default channel id di meta-data  
  (baik), namun perlu pastikan channel callpanion_calls dibuat secara eksplisit jika ingin
  jaminan tampil di Android 8+.                                                           
                                                                                          
  Kesimpulan: Error yang Anda alami saat ini bersumber dari kegagalan OAuth akibat        
  “Invalid JWT Signature” pada fungsi Edge (server-side). Fokus perbaikan adalah          
  memperbaiki secret FCM_SERVICE_ACCOUNT_JSON di Supabase agar pasangan client_email      
  dan private_key valid dan cocok dengan project FCM. Setelah itu, lakukan uji kirim      
  notifikasi lagi. Jika sudah hijau, baru lanjutkan merapikan hal-hal sekunder seperti    
  pembuatan channel Android callpanion_calls agar delivery notifikasi stabil di semua     
  versi Android.