-- Final security implementation - add updated RLS policies

-- 1. Enhanced RLS policies for call_analysis with consent checking
DROP POLICY IF EXISTS "call_analysis_enhanced_access" ON public.call_analysis;

CREATE POLICY "call_analysis_enhanced_access" ON public.call_analysis
FOR SELECT USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM public.relatives r
      JOIN public.household_members hm ON hm.household_id = r.household_id
      WHERE r.id = call_analysis.user_id
        AND hm.user_id = auth.uid()
        AND (
          -- Full access with consent
          (get_user_health_access_level(auth.uid(), r.household_id) = 'FULL_ACCESS' 
           AND has_health_data_consent(r.id, auth.uid(), 'DETAILED_ANALYSIS_ACCESS'::public.consent_type)) OR
          -- Summary access (mood_score only, no transcript/detailed flags)
          (get_user_health_access_level(auth.uid(), r.household_id) = 'SUMMARY_ONLY')
        )
    )
  )
);

-- 2. Enhanced RLS policies for call_logs with consent checking  
DROP POLICY IF EXISTS "call_logs_enhanced_access" ON public.call_logs;

CREATE POLICY "call_logs_enhanced_access" ON public.call_logs
FOR SELECT USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM public.relatives r
      JOIN public.household_members hm ON hm.household_id = r.household_id
      WHERE r.id = call_logs.user_id
        AND hm.user_id = auth.uid()
        AND (
          -- Full access with consent (including audio recordings)
          (get_user_health_access_level(auth.uid(), r.household_id) = 'FULL_ACCESS' 
           AND has_health_data_consent(r.id, auth.uid(), 'CALL_RECORDINGS_ACCESS'::public.consent_type)) OR
          -- Summary access (basic call data only, no audio/detailed health)
          (get_user_health_access_level(auth.uid(), r.household_id) IN ('SUMMARY_ONLY', 'FULL_ACCESS'))
        )
    )
  )
);

-- 3. Set default health access levels for existing household members
UPDATE public.household_members 
SET health_access_level = 
  CASE 
    WHEN role = 'FAMILY_PRIMARY' THEN 'FULL_ACCESS'::public.health_access_level
    ELSE 'SUMMARY_ONLY'::public.health_access_level
  END
WHERE health_access_level IS NULL;