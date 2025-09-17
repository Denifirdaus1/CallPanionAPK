-- Create test function for CallPanion setup validation
CREATE OR REPLACE FUNCTION public.test_callpanion_setup()
RETURNS json AS $$
DECLARE
  _admin uuid;
  _household uuid;
  _relative uuid;
  _invite_id uuid;
  _token text;
  _viewer uuid := gen_random_uuid(); -- fake viewer UUID
  results jsonb := '{}'::jsonb;
BEGIN
  -- 0. Pick an admin user (first authenticated user)
  SELECT id INTO _admin FROM auth.users LIMIT 1;
  
  IF _admin IS NULL THEN
    results := results || jsonb_build_object('error', 'No authenticated users found');
    RETURN results;
  END IF;
  
  results := results || jsonb_build_object('admin_user', _admin);

  -- 1. Create household
  INSERT INTO households (name, created_by)
  VALUES ('Test Household ' || now(), _admin)
  RETURNING id INTO _household;

  results := results || jsonb_build_object('household_created', _household IS NOT NULL);

  -- 2. Add admin as member
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (_household, _admin, 'FAMILY_PRIMARY');

  results := results || jsonb_build_object('admin_member_added', true);

  -- 3. Create relative
  INSERT INTO relatives (
    household_id, first_name, last_name, town, county, country,
    escalation_contact_name, escalation_contact_email
  ) VALUES (
    _household, 'TestRelative', 'Auto', 'Ballycastle', 'Antrim', 'United Kingdom',
    'Test Contact', 'test@example.com'
  )
  RETURNING id INTO _relative;

  results := results || jsonb_build_object('relative_created', _relative IS NOT NULL);

  -- 4. Create invite
  _token := encode(gen_random_bytes(16), 'hex');
  INSERT INTO invites (household_id, email, role, token, invited_by)
  VALUES (_household, 'invitee@example.com', 'viewer', _token, _admin)
  RETURNING id INTO _invite_id;

  results := results || jsonb_build_object('invite_created', _invite_id IS NOT NULL);
  results := results || jsonb_build_object('invite_token', _token);

  -- 5. Simulate invite acceptance
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (_household, _viewer, 'FAMILY_MEMBER');
  
  UPDATE invites SET accepted_at = now() WHERE id = _invite_id;

  results := results || jsonb_build_object('invite_accepted', true);

  -- 6. Verify the setup
  results := results || jsonb_build_object(
    'household_member_count', 
    (SELECT count(*) FROM household_members WHERE household_id = _household)
  );
  
  results := results || jsonb_build_object(
    'relative_count',
    (SELECT count(*) FROM relatives WHERE household_id = _household)
  );

  -- 7. Clean up test data
  DELETE FROM household_members WHERE household_id = _household;
  DELETE FROM invites WHERE household_id = _household;
  DELETE FROM relatives WHERE household_id = _household;
  DELETE FROM households WHERE id = _household;

  results := results || jsonb_build_object('cleanup_completed', true);
  results := results || jsonb_build_object('test_status', 'SUCCESS');

  RETURN results;

EXCEPTION WHEN OTHERS THEN
  -- Clean up on error
  BEGIN
    DELETE FROM household_members WHERE household_id = _household;
    DELETE FROM invites WHERE household_id = _household;
    DELETE FROM relatives WHERE household_id = _household;
    DELETE FROM households WHERE id = _household;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore cleanup errors
  END;
  
  results := results || jsonb_build_object('error', SQLERRM);
  results := results || jsonb_build_object('test_status', 'FAILED');
  RETURN results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;