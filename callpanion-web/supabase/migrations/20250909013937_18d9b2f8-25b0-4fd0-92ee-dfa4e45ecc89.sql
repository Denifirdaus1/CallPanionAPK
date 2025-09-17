-- Create table to track batch call mappings for secure resolution
CREATE TABLE IF NOT EXISTS public.batch_call_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL,
  batch_name TEXT,
  household_id UUID NOT NULL REFERENCES public.households(id),
  relative_id UUID NOT NULL REFERENCES public.relatives(id),
  phone_number TEXT NOT NULL,
  scheduled_time_unix BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  provider_call_id TEXT
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_batch_call_mappings_batch_id ON public.batch_call_mappings(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_call_mappings_phone ON public.batch_call_mappings(phone_number);
CREATE INDEX IF NOT EXISTS idx_batch_call_mappings_provider_call_id ON public.batch_call_mappings(provider_call_id);

-- Enable RLS
ALTER TABLE public.batch_call_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role can manage batch mappings" 
ON public.batch_call_mappings 
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

CREATE POLICY "Household members can view their batch mappings" 
ON public.batch_call_mappings 
FOR SELECT 
USING (household_id IN (
  SELECT household_id FROM public.household_members 
  WHERE user_id = auth.uid()
));