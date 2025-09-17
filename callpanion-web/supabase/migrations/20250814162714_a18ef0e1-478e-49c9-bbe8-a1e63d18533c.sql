-- Fix remaining database functions with secure search_path
CREATE OR REPLACE FUNCTION public.log_audit(_actor_user_id uuid, _actor_email text, _action text, _entity_type text, _entity_id text, _details jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_log (actor_user_id, actor_email, action, entity_type, entity_id, details)
  VALUES (_actor_user_id, _actor_email, _action, _entity_type, _entity_id, _details);
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_case_notes_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Case notes are append-only; updates/deletes are not allowed.';
END;
$function$;

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