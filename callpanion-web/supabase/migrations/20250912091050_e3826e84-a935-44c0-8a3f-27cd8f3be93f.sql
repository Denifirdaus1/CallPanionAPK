-- Update existing households to use in-app call method for testing
UPDATE households 
SET call_method_preference = 'in_app_call' 
WHERE id IN (
  SELECT h.id 
  FROM households h 
  JOIN household_members hm ON h.id = hm.household_id 
  WHERE hm.role = 'FAMILY_PRIMARY'
  LIMIT 3
);

-- Also update any households that have device pairs to use in-app calls
UPDATE households 
SET call_method_preference = 'in_app_call'
WHERE id IN (
  SELECT DISTINCT dp.household_id 
  FROM device_pairs dp 
  WHERE dp.claimed_at IS NOT NULL
);