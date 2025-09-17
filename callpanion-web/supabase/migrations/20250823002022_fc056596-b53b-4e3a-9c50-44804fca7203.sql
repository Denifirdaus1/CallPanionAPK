-- Create RPC functions for privacy settings since types aren't updated yet
CREATE OR REPLACE FUNCTION public.get_user_privacy_settings(user_id UUID)
RETURNS TABLE(
  analytics_consent BOOLEAN,
  marketing_emails BOOLEAN,
  push_notifications BOOLEAN,
  data_sharing_family BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ups.analytics_consent,
    ups.marketing_emails,
    ups.push_notifications,
    ups.data_sharing_family
  FROM public.user_privacy_settings ups
  WHERE ups.user_id = $1 AND ups.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.upsert_user_privacy_settings(
  user_id UUID,
  analytics_consent BOOLEAN,
  marketing_emails BOOLEAN,
  push_notifications BOOLEAN,
  data_sharing_family BOOLEAN
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_privacy_settings (
    user_id, analytics_consent, marketing_emails, push_notifications, data_sharing_family
  ) VALUES (
    $1, $2, $3, $4, $5
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    analytics_consent = EXCLUDED.analytics_consent,
    marketing_emails = EXCLUDED.marketing_emails,
    push_notifications = EXCLUDED.push_notifications,
    data_sharing_family = EXCLUDED.data_sharing_family,
    updated_at = now()
  WHERE user_privacy_settings.user_id = auth.uid();
$$;