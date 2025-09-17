-- Fix the remaining database functions with secure search_path
CREATE OR REPLACE FUNCTION public.check_missed_calls()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If the call was missed, check for consecutive missed calls
  IF NEW.call_outcome = 'missed' THEN
    PERFORM pg_notify('missed_call_alert', 
      json_build_object(
        'user_id', NEW.user_id,
        'timestamp', NEW.timestamp
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role(_uid uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select ou.role
  from public.org_users ou
  where ou.user_id = _uid
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce((select ou.role = 'SUPER_ADMIN' from public.org_users ou where ou.user_id = _uid limit 1), false);
$function$;

CREATE OR REPLACE FUNCTION public.has_admin_access(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select exists (
    select 1 from public.org_users ou
    where ou.user_id = _uid
      and ou.status = 'ACTIVE'
      and ou.role in ('SUPER_ADMIN','SUPPORT')
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select exists (
    select 1
    from public.org_users ou
    where ou.user_id = _uid
      and ou.status = 'ACTIVE'
      and ou.role in ('SUPER_ADMIN','SUPPORT')
      and ou.mfa_enabled = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_household(_uid uuid, _household_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT coalesce(public.has_admin_access_with_mfa(_uid), false)
     OR EXISTS (
       SELECT 1 FROM public.household_members hm
       WHERE hm.household_id = _household_id AND hm.user_id = _uid AND hm.role = 'FAMILY_PRIMARY'
     );
$function$;

CREATE OR REPLACE FUNCTION public.has_access_to_customer(_uid uuid, _customer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT coalesce(public.has_admin_access_with_mfa(_uid), false)
     OR EXISTS (
       SELECT 1
       FROM public.household_members hm_user
       JOIN public.household_members hm_cust
         ON hm_user.household_id = hm_cust.household_id
       WHERE hm_user.user_id = _uid
         AND hm_cust.customer_id = _customer_id
     );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_customer(_uid uuid, _customer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT coalesce(public.has_admin_access_with_mfa(_uid), false)
     OR EXISTS (
       SELECT 1
       FROM public.household_members hm_user
       JOIN public.household_members hm_cust
         ON hm_user.household_id = hm_cust.household_id
       WHERE hm_user.user_id = _uid
         AND hm_user.role = 'FAMILY_PRIMARY'
         AND hm_cust.customer_id = _customer_id
     );
$function$;

CREATE OR REPLACE FUNCTION public.can_self_seed_household(_uid uuid, _household_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    (SELECT h.created_by = _uid FROM public.households h WHERE h.id = _household_id) AND
    NOT EXISTS (
      SELECT 1 FROM public.household_members hm WHERE hm.household_id = _household_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.user_is_household_member(_uid uuid, _household_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id AND hm.user_id = _uid
  );
$function$;