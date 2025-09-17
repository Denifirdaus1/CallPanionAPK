-- Create push_notifications table for logging FCM notifications
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  fcm_response JSONB,
  household_id UUID,
  relative_id UUID,
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

CREATE POLICY "Household members can view their push notifications" 
ON public.push_notifications 
FOR SELECT 
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM household_members 
    WHERE user_id = auth.uid()
  )
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_push_notifications_household_id ON public.push_notifications(household_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_relative_id ON public.push_notifications(relative_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON public.push_notifications(created_at);