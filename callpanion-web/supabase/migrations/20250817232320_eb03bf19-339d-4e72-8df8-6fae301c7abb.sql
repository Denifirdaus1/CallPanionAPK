-- Create legal_acceptances table to track terms acceptance
CREATE TABLE public.legal_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own acceptances
CREATE POLICY "Users can insert their own legal acceptances" 
ON public.legal_acceptances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own acceptances
CREATE POLICY "Users can view their own legal acceptances" 
ON public.legal_acceptances 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view all acceptances
CREATE POLICY "Admins can view all legal acceptances" 
ON public.legal_acceptances 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- Service role can insert acceptances (for edge functions)
CREATE POLICY "Service can insert legal acceptances" 
ON public.legal_acceptances 
FOR INSERT 
WITH CHECK (is_service_role());

-- Create index for performance
CREATE INDEX idx_legal_acceptances_user_id ON public.legal_acceptances(user_id);
CREATE INDEX idx_legal_acceptances_document_type ON public.legal_acceptances(document_type);