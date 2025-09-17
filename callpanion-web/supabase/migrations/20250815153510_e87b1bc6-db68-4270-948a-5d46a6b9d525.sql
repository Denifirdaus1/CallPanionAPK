-- Fix remaining function search path warnings

-- Fix increment_photo_likes function
CREATE OR REPLACE FUNCTION public.increment_photo_likes(photo_id uuid)
RETURNS family_photos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  updated_row public.family_photos;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Increment likes atomically and return the updated row
  UPDATE public.family_photos
  SET likes = coalesce(likes, 0) + 1
  WHERE id = photo_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$function$;

-- Fix manual_hubspot_sync function
CREATE OR REPLACE FUNCTION public.manual_hubspot_sync(household_id_param uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_message text;
BEGIN
  -- Trigger the household sync function manually
  PERFORM sync_household_to_hubspot() FROM households WHERE id = household_id_param;
  
  result_message := 'Manual HubSpot sync triggered for household: ' || household_id_param;
  RETURN result_message;
END;
$function$;