@echo off
echo ========================================
echo   TEST NOTIFICATION FLOW CALLPANION
echo ========================================

echo.
echo Step 1: Deploy Edge Functions...
echo.

echo Deploying schedulerInAppCalls...
npx supabase functions deploy schedulerInAppCalls

echo.
echo Deploying send-fcm-notification...
npx supabase functions deploy send-fcm-notification

echo.
echo Deploying send-apns-voip-notification...
npx supabase functions deploy send-apns-voip-notification

echo.
echo Step 2: Test FCM Notification...
echo.

echo Testing FCM notification for Android...
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-fcm-notification" ^
  -H "Authorization: Bearer YOUR_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"deviceToken\":\"TEST_FCM_TOKEN\",\"title\":\"Test Call\",\"body\":\"Incoming call from family\",\"data\":{\"type\":\"incoming_call\",\"sessionId\":\"test-session-123\"}}"

echo.
echo Step 3: Test APNS VoIP Notification...
echo.

echo Testing APNS VoIP notification for iOS...
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-apns-voip-notification" ^
  -H "Authorization: Bearer YOUR_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"voipToken\":\"TEST_VOIP_TOKEN\",\"title\":\"Test Call\",\"body\":\"Incoming call from family\",\"data\":{\"type\":\"incoming_call\",\"sessionId\":\"test-session-123\"}}"

echo.
echo Step 4: Test Scheduler...
echo.

echo Testing scheduler for queue phase...
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/schedulerInAppCalls" ^
  -H "Authorization: Bearer YOUR_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"action\":\"queue\"}"

echo.
echo Testing scheduler for execute phase...
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/schedulerInAppCalls" ^
  -H "Authorization: Bearer YOUR_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"action\":\"execute\"}"

echo.
echo ========================================
echo   NOTIFICATION FLOW TEST COMPLETED
echo ========================================
echo.
echo Next steps:
echo 1. Check Supabase logs for any errors
echo 2. Test with real device tokens
echo 3. Verify CallKit interface appears
echo 4. Test end-to-end call flow
echo.
pause
