-- Create user privacy settings table
CREATE TABLE IF NOT EXISTS public.user_privacy_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_emails BOOLEAN NOT NULL DEFAULT false,
  push_notifications BOOLEAN NOT NULL DEFAULT false,
  data_sharing_family BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own privacy settings"
  ON public.user_privacy_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create content reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('photo', 'message', 'other')),
  content_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  content_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for content reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for content reports
CREATE POLICY "Users can create content reports"
  ON public.content_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Admins can view all content reports"
  ON public.content_reports
  FOR SELECT
  USING (has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "Admins can update content reports"
  ON public.content_reports
  FOR UPDATE
  USING (has_admin_access_with_mfa(auth.uid()));

-- Create push notification tokens table if not exists
CREATE TABLE IF NOT EXISTS public.push_notification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  device_info JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS for push tokens
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for push tokens
CREATE POLICY "Users can manage their own push tokens"
  ON public.push_notification_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage push tokens"
  ON public.push_notification_tokens
  FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());