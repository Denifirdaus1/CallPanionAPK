-- Create FAQ table for the help system
CREATE TABLE public.faqs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  tags text[] DEFAULT '{}',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active FAQs
CREATE POLICY "faqs_public_read" 
ON public.faqs 
FOR SELECT 
USING (is_active = true);

-- Policy: Admins can manage FAQs
CREATE POLICY "faqs_admin_manage" 
ON public.faqs 
FOR ALL 
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- Insert the CallPanion FAQ data
INSERT INTO public.faqs (question, answer, display_order) VALUES
('What is CallPanion?', 'CallPanion helps older adults live safely at home with friendly AI wellbeing calls, optional wearable integration, and a private family dashboard for check-ins and photos.', 1),
('Is this a replacement for family contact?', 'No. CallPanion is an add-on, not a replacement. It complements regular family contact and care.', 2),
('How do the AI calls work?', 'You set the frequency (e.g. three times a day). The calls are friendly check-ins, tailored to the person''s interests, and can flag changes in mood or routine to the family dashboard.', 3),
('Do I need a wearable?', 'Optional. CallPanion works without one. Wearables add extra insight (e.g. activity trends, sleep indicators, fall-risk signals).', 4),
('Is my data secure?', 'Yes. We follow UK GDPR. Data is encrypted in transit and at rest. You can request access or deletion at any time.', 5),
('Who can see the data?', 'Only the older person and authorised family/carers. You control who has access via the family dashboard.', 6),
('How much does it cost?', 'We''ll publish pricing at launch. Join the waitlist for early-access offers.', 7),
('Can health or social care teams use it?', 'Yes, we''re designing professional views for care teams. Register interest via the waitlist and we''ll be in touch.', 8),
('How do I join the waitlist?', 'Share your name + email and consent below. We''ll send early-access updates.', 9),
('How do I contact a human?', 'Email callpanion@gmail.com (Mon–Fri, 09:00–17:00 UK). We aim to reply within one working day.', 10);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();