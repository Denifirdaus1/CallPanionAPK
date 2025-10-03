class AppConstants {
  // API Configuration
  static const String supabaseUrl = 'https://umjtepmdwfyfhdzbkyli.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE';

  // Edge Functions URLs
  static const String registerFcmTokenUrl = '$supabaseUrl/functions/v1/register-fcm-token';
  static const String updateCallStatusUrl = '$supabaseUrl/functions/v1/updateCallStatus';
  static const String checkScheduledCallsUrl = '$supabaseUrl/functions/v1/check-scheduled-calls';

  // Note: Elderly UI is fully native Flutter. No WebView endpoint required.

  // Shared Preferences Keys
  static const String keyDeviceToken = 'device_token';
  static const String keyVoipToken = 'voip_token';
  static const String keyPairingToken = 'pairing_token';
  static const String keyUserId = 'user_id';
  static const String keyRelativeName = 'relative_name';
  static const String keyHouseholdId = 'household_id';
  static const String keyRelativeId = 'relative_id';
  static const String keyPendingCall = 'pending_call';
  static const String keySupabaseSession = 'supabase_session';

  // Call Types
  static const String callTypeInApp = 'in_app_call';
  static const String callTypeElevenLabs = 'elevenlabs_call';

  // Call Status
  static const String callStatusScheduled = 'scheduled';
  static const String callStatusActive = 'active';
  static const String callStatusCompleted = 'completed';
  static const String callStatusMissed = 'missed';
  static const String callStatusDeclined = 'declined';
}