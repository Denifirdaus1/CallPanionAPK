-- Fix function search_path security issue
ALTER FUNCTION elder.generate_pairing_code() SET search_path = '';

-- Create missing API endpoints for Flutter integration
CREATE OR REPLACE FUNCTION notify_incoming_call(
  target_device_id UUID,
  caller_name TEXT,
  session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Function to send push notification to Flutter app
  -- This would be called when an in-app call is initiated
  INSERT INTO push_notifications (
    device_id,
    title,
    body,
    data,
    created_at
  ) VALUES (
    target_device_id,
    'Incoming Call',
    'Call from ' || caller_name,
    jsonb_build_object('type', 'incoming_call', 'session_id', session_id),
    now()
  );
END;
$$;

-- Create push notifications table if not exists
CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES elder.devices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policy for push notifications
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Device owners can view their notifications" ON push_notifications
  USING (EXISTS (
    SELECT 1 FROM elder.devices d 
    WHERE d.id = push_notifications.device_id 
    AND d.user_id = auth.uid()
  ));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_push_notifications_device ON push_notifications(device_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_created ON push_notifications(created_at);