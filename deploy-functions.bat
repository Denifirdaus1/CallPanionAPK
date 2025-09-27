@echo off
echo ========================================
echo   DEPLOY CALLPANION EDGE FUNCTIONS
echo ========================================

echo.
echo Step 1: Login to Supabase...
npx supabase login

echo.
echo Step 2: Link to your project...
echo Please enter your Supabase Project Reference ID:
set /p PROJECT_REF="Project Ref: "
npx supabase link --project-ref %PROJECT_REF%

echo.
echo Step 3: Deploy Edge Functions...
echo.

echo Deploying elevenlabs-device-call...
npx supabase functions deploy elevenlabs-device-call

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
echo Deploying pair-init...
npx supabase functions deploy pair-init

echo.
echo Deploying pair-claim...
npx supabase functions deploy pair-claim

echo.
echo Deploying elevenlabs-webhook...
npx supabase functions deploy elevenlabs-webhook

echo.
echo ========================================
echo   DEPLOYMENT COMPLETED!
echo ========================================
echo.
echo Next steps:
echo 1. Set secrets in Supabase Dashboard
echo 2. Test the functions
echo.
pause
