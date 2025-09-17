-- Drop existing policies and recreate with proper security
DROP POLICY IF EXISTS "Household members can view family photos" ON storage.objects;
DROP POLICY IF EXISTS "Household members can upload family photos" ON storage.objects;
DROP POLICY IF EXISTS "Household members can view family media" ON storage.objects;
DROP POLICY IF EXISTS "Household members can upload family media" ON storage.objects;

-- Make buckets private by default
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('family-photos', 'family-media');

-- Create secure storage policies for family-photos
CREATE POLICY "Household members can view family photos" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'family-photos' AND
    auth.uid() IN (
      SELECT hm.user_id 
      FROM household_members hm 
      WHERE hm.household_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Household members can upload family photos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'family-photos' AND
    auth.uid() IN (
      SELECT hm.user_id 
      FROM household_members hm 
      WHERE hm.household_id::text = (storage.foldername(name))[1]
    )
  );

-- Create secure storage policies for family-media  
CREATE POLICY "Household members can view family media" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'family-media' AND
    auth.uid() IN (
      SELECT hm.user_id 
      FROM household_members hm 
      WHERE hm.household_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Household members can upload family media" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'family-media' AND
    auth.uid() IN (
      SELECT hm.user_id 
      FROM household_members hm 
      WHERE hm.household_id::text = (storage.foldername(name))[1]
    )
  );

-- Add RLS policies for devices table to match access patterns
DROP POLICY IF EXISTS "Users can manage their own devices" ON devices;
DROP POLICY IF EXISTS "Household admins can view member devices" ON devices;

CREATE POLICY "Users can manage their own devices" ON devices
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Household admins can view member devices" ON devices
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT hm1.user_id
      FROM household_members hm1
      JOIN household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm2.user_id = devices.user_id
        AND hm1.role = 'FAMILY_PRIMARY'
    )
  );