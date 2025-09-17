-- Fix the remaining two functions that don't have search_path set
CREATE OR REPLACE FUNCTION public.fix_auth_rls_initplan(p_schema text, p_table text, p_policy text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    policy_definition TEXT;
    fixed_definition TEXT;
BEGIN
    -- Get the current policy definition
    SELECT pg_get_policydef(pol.oid)
    INTO policy_definition
    FROM pg_policy pol
    JOIN pg_class cls ON pol.polrelid = cls.oid
    JOIN pg_namespace ns ON cls.relnamespace = ns.oid
    WHERE ns.nspname = p_schema
    AND cls.relname = p_table
    AND pol.polname = p_policy;

    -- Fix the definition by wrapping auth.uid() calls in SELECT
    fixed_definition := regexp_replace(
        policy_definition,
        'auth\.uid\(\)',
        '(SELECT auth.uid())',
        'g'
    );

    -- Return the ALTER POLICY statement
    RETURN 'ALTER POLICY "' || p_policy || '" ON ' || p_schema || '.' || p_table || ' ' ||
           SUBSTRING(fixed_definition FROM position('USING' in fixed_definition)) || ';';
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_all_rls_fixes()
RETURNS TABLE(fix_sql text)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    policy_rec RECORD;
    policy_definition TEXT;
    fixed_definition TEXT;
    alter_sql TEXT;
BEGIN
    FOR policy_rec IN 
        SELECT 
            n.nspname AS schema_name,
            c.relname AS table_name,
            p.polname AS policy_name
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY 1, 2, 3
    LOOP
        -- Get current policy definition
        SELECT pg_get_policydef(pol.oid)
        INTO policy_definition
        FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        JOIN pg_namespace ns ON cls.relnamespace = ns.oid
        WHERE ns.nspname = policy_rec.schema_name
        AND cls.relname = policy_rec.table_name
        AND pol.polname = policy_rec.policy_name;
        
        -- Only process if it contains raw auth.uid() call
        IF policy_definition LIKE '%auth.uid()%' AND 
           policy_definition NOT LIKE '%(SELECT auth.uid())%' THEN
           
            -- Fix the definition
            fixed_definition := regexp_replace(
                policy_definition,
                'auth\.uid\(\)',
                '(SELECT auth.uid())',
                'g'
            );
            
            -- Create ALTER POLICY statement
            alter_sql := 'ALTER POLICY "' || policy_rec.policy_name || '" ON ' || 
                         policy_rec.schema_name || '.' || policy_rec.table_name || ' ' ||
                         SUBSTRING(fixed_definition FROM position('USING' in fixed_definition)) || ';';
            
            fix_sql := alter_sql;
            RETURN NEXT;
        END IF;
    END LOOP;
    RETURN;
END;
$function$;