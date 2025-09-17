-- Phase 0 Implementation: Push Notifications, Media Storage, Configuration

-- 1. Push notification tokens table
CREATE TABLE public.push_notification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, token)
);

-- 2. Notification history table
CREATE TABLE public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Media uploads table for tracking
CREATE TABLE public.media_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID NOT NULL,
  household_id UUID NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'processed', 'failed')),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  delivered_to JSONB DEFAULT '[]', -- Array of user IDs who received it
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Configuration settings table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Alert rules table
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('missed_calls', 'health_concern', 'emergency', 'custom')),
  conditions JSONB NOT NULL, -- e.g., {"missed_calls": 3, "timeframe": "24h"}
  actions JSONB NOT NULL, -- e.g., {"notify_users": ["uuid1"], "send_sms": true}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('family-media', 'family-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime']::text[]),
  ('family-photos', 'family-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif']::text[]);

-- Enable RLS
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Push notification tokens - users can only manage their own
CREATE POLICY "Users can manage their own push tokens"
ON public.push_notification_tokens
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Notification history - users can view their own, admins can view all
CREATE POLICY "Users can view their own notifications"
ON public.notification_history
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all notifications"
ON public.notification_history
FOR ALL
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "Service can insert notifications"
ON public.notification_history
FOR INSERT
WITH CHECK (is_service_role());

-- Media uploads - household members can view, uploaders can manage
CREATE POLICY "Household members can view media uploads"
ON public.media_uploads
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM household_members hm
  WHERE hm.household_id = media_uploads.household_id 
    AND hm.user_id = auth.uid()
));

CREATE POLICY "Users can upload to their household"
ON public.media_uploads
FOR INSERT
WITH CHECK (uploaded_by = auth.uid() AND EXISTS (
  SELECT 1 FROM household_members hm
  WHERE hm.household_id = media_uploads.household_id 
    AND hm.user_id = auth.uid()
));

CREATE POLICY "Uploaders can update their uploads"
ON public.media_uploads
FOR UPDATE
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

-- App settings - only admins
CREATE POLICY "Admins can manage app settings"
ON public.app_settings
FOR ALL
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- Alert rules - household members can view, admins can manage
CREATE POLICY "Household members can view alert rules"
ON public.alert_rules
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM household_members hm
  WHERE hm.household_id = alert_rules.household_id 
    AND hm.user_id = auth.uid()
));

CREATE POLICY "Household admins can manage alert rules"
ON public.alert_rules
FOR ALL
USING (app_is_household_admin(household_id))
WITH CHECK (app_is_household_admin(household_id));

-- Storage policies
CREATE POLICY "Household members can view family media"
ON storage.objects
FOR SELECT
USING (bucket_id IN ('family-media', 'family-photos') AND EXISTS (
  SELECT 1 FROM media_uploads mu
  JOIN household_members hm ON hm.household_id = mu.household_id
  WHERE mu.storage_path = name AND hm.user_id = auth.uid()
));

CREATE POLICY "Household members can upload family media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id IN ('family-media', 'family-photos') AND auth.uid() IS NOT NULL);

CREATE POLICY "Uploaders can manage their media"
ON storage.objects
FOR ALL
USING (bucket_id IN ('family-media', 'family-photos') AND EXISTS (
  SELECT 1 FROM media_uploads mu
  WHERE mu.storage_path = name AND mu.uploaded_by = auth.uid()
));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_notification_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_uploads_updated_at
  BEFORE UPDATE ON public.media_uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();