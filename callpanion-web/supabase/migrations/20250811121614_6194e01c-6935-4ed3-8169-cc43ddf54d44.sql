-- Fix: add SET search_path for prevent_case_notes_mutation to satisfy linter 0011
CREATE OR REPLACE FUNCTION public.prevent_case_notes_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Case notes are append-only; updates/deletes are not allowed.';
END;
$$;