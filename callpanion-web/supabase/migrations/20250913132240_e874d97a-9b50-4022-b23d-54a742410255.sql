-- Security enhancement: Add unique constraint to prevent token reuse
-- and add household validation for FCM tokens

-- 1. Prevent multiple claims of same pairing code
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_pairs_code_claimed 
ON device_pairs (code_6) 
WHERE claimed_at IS NOT NULL;

-- 2. Add household validation for FCM notification security
CREATE OR REPLACE FUNCTION validate_fcm_token_household(
  _device_token text,
  _household_id uuid,
  _relative_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if device token belongs to the specified household through device pairing
  RETURN EXISTS (
    SELECT 1 FROM device_pairs dp
    WHERE dp.household_id = _household_id
      AND (_relative_id IS NULL OR dp.relative_id = _relative_id)
      AND dp.claimed_at IS NOT NULL
      AND (
        dp.device_info->>'fcm_token' = _device_token OR
        EXISTS (
          SELECT 1 FROM push_notification_tokens pnt
          WHERE pnt.user_id = dp.claimed_by 
            AND pnt.token = _device_token
            AND pnt.is_active = true
        )
      )
  );
END;
$$;

-- 3. Add index for faster FCM token validation
CREATE INDEX IF NOT EXISTS idx_device_pairs_household_claimed
ON device_pairs (household_id, claimed_at) 
WHERE claimed_at IS NOT NULL;

-- 4. Add policy to ensure FCM tokens are properly isolated by household
ALTER POLICY "Device owners can view their notifications" ON push_notifications
USING (
  -- Original owner check
  (EXISTS (
    SELECT 1 FROM elder.devices d
    WHERE d.push_token = push_notifications.device_token
      AND d.customer_id = push_notifications.customer_id
  )) OR
  -- Additional household isolation check
  (household_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = push_notifications.household_id
      AND hm.user_id = auth.uid()
  ))
);

-- 5. Add trigger to prevent cross-household FCM notifications
CREATE OR REPLACE FUNCTION prevent_cross_household_fcm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only validate for new inserts with household context
  IF TG_OP = 'INSERT' AND NEW.household_id IS NOT NULL AND NEW.relative_id IS NOT NULL THEN
    -- Verify device token belongs to the specified household
    IF NOT validate_fcm_token_household(NEW.device_token, NEW.household_id, NEW.relative_id) THEN
      RAISE EXCEPTION 'FCM token validation failed: token does not belong to specified household/relative'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_fcm_household
  BEFORE INSERT ON push_notifications
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cross_household_fcm();