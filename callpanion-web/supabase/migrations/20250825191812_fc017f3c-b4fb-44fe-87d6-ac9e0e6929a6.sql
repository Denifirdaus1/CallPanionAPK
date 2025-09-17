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