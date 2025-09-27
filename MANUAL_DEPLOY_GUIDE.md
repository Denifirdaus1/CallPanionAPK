# 🚀 PANDUAN DEPLOY MANUAL EDGE FUNCTIONS CALLPANION

## 📋 **METODE 1: VIA SUPABASE DASHBOARD (RECOMMENDED)**

### **Step 1: Buka Supabase Dashboard**
1. Login ke [supabase.com](https://supabase.com)
2. Pilih project CallPanion Anda
3. Klik **"Edge Functions"** di sidebar kiri

### **Step 2: Deploy Setiap Function**

#### **2.1 Deploy `elevenlabs-device-call`**
1. Klik **"Create a new function"**
2. Function name: `elevenlabs-device-call`
3. Copy paste kode dari file: `supabase/functions/elevenlabs-device-call/index.ts`
4. Klik **"Deploy"**

#### **2.2 Deploy `schedulerInAppCalls`**
1. Klik **"Create a new function"**
2. Function name: `schedulerInAppCalls`
3. Copy paste kode dari file: `supabase/functions/schedulerInAppCalls/index.ts`
4. Klik **"Deploy"**

#### **2.3 Deploy `send-fcm-notification`**
1. Klik **"Create a new function"**
2. Function name: `send-fcm-notification`
3. Copy paste kode dari file: `supabase/functions/send-fcm-notification/index.ts`
4. Klik **"Deploy"**

#### **2.4 Deploy `send-apns-voip-notification`**
1. Klik **"Create a new function"**
2. Function name: `send-apns-voip-notification`
3. Copy paste kode dari file: `supabase/functions/send-apns-voip-notification/index.ts`
4. Klik **"Deploy"**

#### **2.5 Deploy `pair-init`**
1. Klik **"Create a new function"**
2. Function name: `pair-init`
3. Copy paste kode dari file: `supabase/functions/pair-init/index.ts`
4. Klik **"Deploy"**

#### **2.6 Deploy `pair-claim`**
1. Klik **"Create a new function"**
2. Function name: `pair-claim`
3. Copy paste kode dari file: `supabase/functions/pair-claim/index.ts`
4. Klik **"Deploy"**

#### **2.7 Deploy `elevenlabs-webhook`**
1. Klik **"Create a new function"**
2. Function name: `elevenlabs-webhook`
3. Copy paste kode dari file: `supabase/functions/elevenlabs-webhook/index.ts`
4. Klik **"Deploy"**

### **Step 3: Set Secrets (Environment Variables)**
1. Di Supabase Dashboard, klik **"Settings"** → **"Edge Functions"**
2. Scroll ke **"Environment Variables"**
3. Tambahkan secrets berikut:

```
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret
ELEVEN_AGENT_ID_IN_APP=your_agent_id
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
FCM_SERVER_KEY=your_fcm_server_key
APNS_KEY_ID=your_apns_key_id
APNS_TEAM_ID=your_team_id
APNS_KEY_BASE64=your_base64_key
APNS_BUNDLE_ID=your_bundle_id
APNS_TOPIC_VOIP=your_voip_topic
APNS_ENV=sandbox
```

---

## 📋 **METODE 2: VIA CLI (AUTOMATED)**

### **Step 1: Jalankan Script Deploy**
```bash
# Double-click file deploy-functions.bat
# Atau jalankan di terminal:
deploy-functions.bat
```

### **Step 2: Follow Instructions**
Script akan memandu Anda untuk:
1. Login ke Supabase
2. Link ke project
3. Deploy semua functions
4. Set secrets

---

## 📋 **METODE 3: MANUAL CLI COMMANDS**

### **Step 1: Login & Link**
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

### **Step 2: Deploy Functions**
```bash
npx supabase functions deploy elevenlabs-device-call
npx supabase functions deploy schedulerInAppCalls
npx supabase functions deploy send-fcm-notification
npx supabase functions deploy send-apns-voip-notification
npx supabase functions deploy pair-init
npx supabase functions deploy pair-claim
npx supabase functions deploy elevenlabs-webhook
```

### **Step 3: Set Secrets**
```bash
npx supabase secrets set ELEVENLABS_API_KEY=your_api_key
npx supabase secrets set ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret
npx supabase secrets set ELEVEN_AGENT_ID_IN_APP=your_agent_id
# ... dan seterusnya untuk semua secrets
```

---

## ✅ **VERIFIKASI DEPLOYMENT**

### **1. Cek Functions di Dashboard**
- Buka Supabase Dashboard → Edge Functions
- Pastikan semua 7 functions terdeploy

### **2. Test Functions**
```bash
# Test elevenlabs-device-call
npx supabase functions invoke elevenlabs-device-call --data '{"test": true}'

# Test pair-init
npx supabase functions invoke pair-init --data '{"relative_id": "test"}'
```

### **3. Cek Logs**
- Di Dashboard → Edge Functions → pilih function → Logs
- Pastikan tidak ada error

---

## 🚨 **TROUBLESHOOTING**

### **Error: Function not found**
- Pastikan function name sama persis
- Cek apakah sudah terdeploy

### **Error: Invalid pairing token**
- Pastikan secrets sudah di-set
- Cek database connection

### **Error: CORS issues**
- Pastikan CORS headers sudah benar
- Test dari browser dengan proper headers

---

## 📊 **STATUS CHECKLIST**

- [ ] Login ke Supabase
- [ ] Link ke project
- [ ] Deploy elevenlabs-device-call
- [ ] Deploy schedulerInAppCalls
- [ ] Deploy send-fcm-notification
- [ ] Deploy send-apns-voip-notification
- [ ] Deploy pair-init
- [ ] Deploy pair-claim
- [ ] Deploy elevenlabs-webhook
- [ ] Set semua secrets
- [ ] Test functions
- [ ] Cek logs

**Selesai! Edge functions CallPanion sudah siap digunakan! 🎉**
