
-- Add a metadata column to hold invite details/permissions sent by the edge function
ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
