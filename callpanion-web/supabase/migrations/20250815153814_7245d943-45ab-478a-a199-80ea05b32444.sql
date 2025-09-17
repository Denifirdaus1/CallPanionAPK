-- Fix the remaining functions with mutable search paths

-- Fix log_failed_access_attempt function (void return type)
CREATE OR REPLACE FUNCTION public.log_failed_access_attempt(resource_name text, resource_id uuid, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Function logic remains the same
    INSERT INTO public.access_attempt_logs (resource_name, resource_id, user_id, success, created_at)
    VALUES (resource_name, resource_id, user_id, false, now());
END;
$function$;

-- Fix log_failed_access_attempt function (trigger return type)
CREATE OR REPLACE FUNCTION public.log_failed_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log failed RLS policy access
  PERFORM log_security_event('rls_access_denied', jsonb_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'timestamp', now()
  ));
  
  RETURN NULL;
END;
$function$;