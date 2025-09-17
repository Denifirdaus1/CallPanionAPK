-- Create conversation insights table for AI analysis results
CREATE TABLE IF NOT EXISTS public.conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.call_sessions(id),
  relative_id UUID REFERENCES public.relatives(id),
  analysis_type TEXT NOT NULL DEFAULT 'wellbeing_check',
  mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
  wellbeing_indicators JSONB DEFAULT '{}',
  health_concerns TEXT[] DEFAULT ARRAY[]::TEXT[],
  key_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  alerts TEXT[] DEFAULT ARRAY[]::TEXT[],
  raw_analysis JSONB DEFAULT '{}',
  transcript_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on conversation_insights
ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;

-- Policy for household members to view insights for their relatives
CREATE POLICY "Household members can view conversation insights" 
ON public.conversation_insights
FOR SELECT
USING (
  relative_id IN (
    SELECT r.id FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE hm.user_id = auth.uid()
  )
);

-- Policy for service role to manage all insights
CREATE POLICY "Service role can manage all conversation insights"
ON public.conversation_insights
FOR ALL
USING (is_service_role())
WITH CHECK (is_service_role());

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_insights_relative_id ON public.conversation_insights(relative_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_session_id ON public.conversation_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_mood_score ON public.conversation_insights(mood_score);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_created_at ON public.conversation_insights(created_at);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_conversation_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER conversation_insights_updated_at
  BEFORE UPDATE ON public.conversation_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_insights_updated_at();