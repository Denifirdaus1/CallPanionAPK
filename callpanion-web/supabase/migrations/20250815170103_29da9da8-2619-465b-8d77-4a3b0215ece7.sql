-- SECURITY FIX 1: Fix family_photos RLS policies to prevent cross-household access

-- Drop existing policies with potential vulnerabilities
DROP POLICY IF EXISTS "Users can insert photos in their household" ON public.family_photos;
DROP POLICY IF EXISTS "Owners can update photos in their household" ON public.family_photos;

-- Create secure policies that properly validate household membership
CREATE POLICY "family_photos_secure_insert" ON public.family_photos
FOR INSERT TO authenticated 
WITH CHECK (
  (user_id = auth.uid() OR user_id IS NULL) AND
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = family_photos.household_id 
      AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "family_photos_secure_update" ON public.family_photos
FOR UPDATE TO authenticated 
USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = family_photos.household_id 
      AND hm.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = family_photos.household_id 
      AND hm.user_id = auth.uid()
  )
);

-- SECURITY FIX 2: Create secure invite acceptance function
CREATE OR REPLACE FUNCTION public.accept_invite_secure_v2(invite_token text, gdpr_consent boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  invite_record record;
  current_user_email text;
  household_name text;
BEGIN
  -- Get current user's email
  SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
  
  IF current_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get and validate invite with comprehensive checks
  SELECT 
    i.*,
    h.name as household_name
  INTO invite_record 
  FROM public.invites i
  JOIN public.households h ON h.id = i.household_id
  WHERE i.token = invite_token 
    AND i.email = current_user_email
    AND i.expires_at > now() 
    AND i.accepted_at IS NULL;
  
  IF invite_record.id IS NULL THEN
    -- Log security event for failed attempt
    INSERT INTO public.security_events (user_id, event_type, details)
    VALUES (auth.uid(), 'invalid_invite_acceptance', jsonb_build_object(
      'token_provided', true,
      'user_email', current_user_email,
      'timestamp', now()
    ));
    
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.household_members 
    WHERE household_id = invite_record.household_id 
      AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already a household member');
  END IF;

  -- Update invite as accepted (atomic transaction)
  UPDATE public.invites 
  SET 
    accepted_at = now(),
    gdpr_consent_status = gdpr_consent,
    gdpr_consent_timestamp = CASE WHEN gdpr_consent THEN now() ELSE NULL END
  WHERE id = invite_record.id;

  -- Add user to household
  INSERT INTO public.household_members (household_id, user_id, role, added_by)
  VALUES (
    invite_record.household_id, 
    auth.uid(), 
    invite_record.role::household_member_role, 
    invite_record.invited_by
  );

  -- Log successful acceptance
  INSERT INTO public.security_events (user_id, event_type, details)
  VALUES (auth.uid(), 'invite_accepted_secure', jsonb_build_object(
    'household_id', invite_record.household_id,
    'role', invite_record.role,
    'household_name', invite_record.household_name
  ));

  RETURN jsonb_build_object(
    'success', true, 
    'household_id', invite_record.household_id,
    'household_name', invite_record.household_name,
    'role', invite_record.role
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO public.security_events (user_id, event_type, details)
  VALUES (auth.uid(), 'invite_acceptance_error', jsonb_build_object(
    'error', SQLERRM,
    'token_provided', true
  ));
  
  RETURN jsonb_build_object('success', false, 'error', 'Invite acceptance failed');
END;
$$;

-- SECURITY FIX 3: Clean up duplicate/conflicting RLS policies on household_members
DROP POLICY IF EXISTS "admins can delete household_members" ON public.household_members;
DROP POLICY IF EXISTS "admins can insert household_members" ON public.household_members;
DROP POLICY IF EXISTS "members can select household_members" ON public.household_members;