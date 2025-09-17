-- Create push_notifications table for logging FCM notifications (simplified)
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  fcm_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service role can manage push notifications" 
ON public.push_notifications 
FOR ALL 
TO authenticated
USING (is_service_role())
WITH CHECK (is_service_role());

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON public.push_notifications(created_at);