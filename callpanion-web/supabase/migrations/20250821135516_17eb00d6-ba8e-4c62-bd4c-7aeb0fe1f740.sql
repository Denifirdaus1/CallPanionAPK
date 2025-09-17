-- Phase 0 Implementation: Push Notifications, Media Storage, Configuration (Revised)

-- 1. Push notification tokens table
CREATE TABLE IF NOT EXISTS public.push_notification_tokens (
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
CREATE TABLE IF NOT EXISTS public.notification_history (
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
CREATE TABLE IF NOT EXISTS public.media_uploads (
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
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Alert rules table
CREATE TABLE IF NOT EXISTS public.alert_rules (
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

-- Create storage buckets (if they don't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'family-media', 'family-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'family-media');

-- Enable RLS on new tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_notification_tokens' AND table_schema = 'public') THEN
        RAISE NOTICE 'Tables already exist, skipping RLS setup';
    ELSE
        ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
    END IF;
END$$;

-- RLS Policies (only create if they don't exist)

-- Push notification tokens
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'push_notification_tokens' AND policyname = 'Users can manage their own push tokens'
    ) THEN
        CREATE POLICY "Users can manage their own push tokens"
        ON public.push_notification_tokens
        FOR ALL
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END$$;

-- Notification history policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notification_history' AND policyname = 'Users can view their own notifications'
    ) THEN
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
    END IF;
END$$;

-- Media uploads policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'media_uploads' AND policyname = 'Household members can view media uploads'
    ) THEN
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
    END IF;
END$$;

-- App settings policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Admins can manage app settings'
    ) THEN
        CREATE POLICY "Admins can manage app settings"
        ON public.app_settings
        FOR ALL
        USING (has_admin_access_with_mfa(auth.uid()))
        WITH CHECK (has_admin_access_with_mfa(auth.uid()));
    END IF;
END$$;

-- Alert rules policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'alert_rules' AND policyname = 'Household members can view alert rules'
    ) THEN
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
    END IF;
END$$;