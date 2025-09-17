-- Fix security warnings by setting search_path for all functions

-- Update generate_ticket_number function
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'CS-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('ticket_sequence')::TEXT, 4, '0');
END;
$$;

-- Update set_ticket_number function
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Update update_support_ticket_timestamp function
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update get_current_oncall function
CREATE OR REPLACE FUNCTION get_current_oncall()
RETURNS TABLE(user_id UUID, contact_method TEXT, contact_details TEXT) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT so.user_id, so.contact_method, so.contact_details
  FROM public.support_oncall so
  WHERE now() BETWEEN so.start_time AND so.end_time
    AND so.is_primary = true
  ORDER BY so.created_at DESC
  LIMIT 1;
END;
$$;