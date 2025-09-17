-- Create waitlist table
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT false,
  consent_text TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  confirm_token UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on waitlist
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Create policy to allow edge functions to insert
CREATE POLICY "Edge functions can insert waitlist entries"
ON public.waitlist FOR INSERT
WITH CHECK (is_service_role());

-- Create policy to allow edge functions to read for duplicate checking
CREATE POLICY "Edge functions can read waitlist entries"
ON public.waitlist FOR SELECT
USING (is_service_role());

-- Create index on email for performance
CREATE INDEX idx_waitlist_email ON public.waitlist(email);

-- Create index on confirm_token for email confirmation
CREATE INDEX idx_waitlist_confirm_token ON public.waitlist(confirm_token) WHERE confirm_token IS NOT NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_waitlist_updated_at_trigger
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_waitlist_updated_at();