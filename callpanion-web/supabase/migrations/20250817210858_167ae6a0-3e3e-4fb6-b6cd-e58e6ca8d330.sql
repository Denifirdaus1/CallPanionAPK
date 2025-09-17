-- Create a secure function to ensure current user becomes family admin
CREATE OR REPLACE FUNCTION public.ensure_family_admin_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  current_user_id uuid;
  user_family_id uuid;
  existing_admin_count integer;
  new_family_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Check if user is already in a family
  SELECT family_id INTO user_family_id
  FROM public.family_members
  WHERE user_id = current_user_id
  LIMIT 1;

  -- Case 1: User has no family - create one and make them admin
  IF user_family_id IS NULL THEN
    -- Create new family
    INSERT INTO public.families (name, created_by)
    VALUES ('My Family', current_user_id)
    RETURNING id INTO new_family_id;
    
    -- Add user as admin
    INSERT INTO public.family_members (family_id, user_id, role, can_view_family_health)
    VALUES (new_family_id, current_user_id, 'admin', true);
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Created new family and set as administrator',
      'family_id', new_family_id
    );
  END IF;

  -- Case 2: User has family - check if they can become admin
  SELECT COUNT(*) INTO existing_admin_count
  FROM public.family_members
  WHERE family_id = user_family_id AND role = 'admin';

  -- If no admins exist, promote current user
  IF existing_admin_count = 0 THEN
    UPDATE public.family_members
    SET role = 'admin', can_view_family_health = true
    WHERE family_id = user_family_id AND user_id = current_user_id;
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Promoted to family administrator',
      'family_id', user_family_id
    );
  END IF;

  -- Check if user is already an admin
  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = user_family_id 
      AND user_id = current_user_id 
      AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'You are already a family administrator',
      'family_id', user_family_id
    );
  END IF;

  -- Family already has admin(s) and user is not one
  RETURN jsonb_build_object(
    'success', false, 
    'error', 'Family already has an administrator. Contact them to change roles.',
    'family_id', user_family_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'error', 'Failed to set up family administrator: ' || SQLERRM
  );
END;
$$;