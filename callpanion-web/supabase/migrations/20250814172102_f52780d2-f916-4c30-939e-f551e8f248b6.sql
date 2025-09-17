-- Create waitlist table for CallPanion landing page
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (position('@' IN email) > 1),
  consent BOOLEAN NOT NULL DEFAULT false,
  consent_text TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  confirm_token TEXT,
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create site_content table for admin configuration
CREATE TABLE IF NOT EXISTS public.site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist (email);
CREATE INDEX IF NOT EXISTS idx_waitlist_confirmed ON public.waitlist (confirmed_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_token ON public.waitlist (confirm_token);
CREATE INDEX IF NOT EXISTS idx_site_content_key ON public.site_content (key);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- RLS policies for waitlist (public can insert, admins can read)
CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read waitlist" ON public.waitlist
  FOR SELECT USING (has_admin_access_with_mfa(auth.uid()));

-- RLS policies for site_content (public can read, admins can manage)
CREATE POLICY "Anyone can read site content" ON public.site_content
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage site content" ON public.site_content
  FOR ALL USING (has_admin_access_with_mfa(auth.uid()));

-- Insert default site content
INSERT INTO public.site_content (key, value) VALUES
  ('hero_headline', 'Stay close. Keep them safe.'),
  ('hero_subhead', 'AI wellbeing calls and a private family dashboard to help older adults live well at home.'),
  ('social_proof_enabled', 'true'),
  ('social_proof_text', 'Backed by UK innovation grants & advisors')
ON CONFLICT (key) DO NOTHING;