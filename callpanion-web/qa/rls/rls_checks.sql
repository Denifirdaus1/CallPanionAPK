-- CallPanion Row Level Security (RLS) Verification Script
-- This script tests RLS policies across all user roles and tables
-- Run with different user contexts to verify proper access control

-- Test Configuration
-- Replace these UUIDs with actual test user IDs from your auth.users table
\set admin_a '22222222-2222-2222-2222-222222222222'
\set member_b '77777777-7777-7777-7777-777777777777'  
\set member_c '99999999-9999-9999-9999-999999999999'
\set admin_d '44444444-4444-4444-4444-444444444444'
\set household_1 '11111111-1111-1111-1111-111111111111'
\set household_2 '33333333-3333-3333-3333-333333333333'

-- Results tracking table
CREATE TEMP TABLE rls_test_results (
    test_id SERIAL PRIMARY KEY,
    user_role TEXT,
    table_name TEXT,
    operation TEXT,
    expected_result TEXT,
    actual_result TEXT,
    test_status TEXT,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Helper function to safely test operations and log results
CREATE OR REPLACE FUNCTION test_rls_operation(
    p_user_role TEXT,
    p_table_name TEXT, 
    p_operation TEXT,
    p_expected TEXT,
    p_sql TEXT
) RETURNS VOID AS $$
DECLARE
    v_result TEXT := 'UNKNOWN';
    v_error TEXT := NULL;
    v_count INTEGER;
BEGIN
    BEGIN
        EXECUTE p_sql;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        
        CASE p_operation
            WHEN 'SELECT' THEN
                v_result := CASE WHEN v_count > 0 THEN 'ALLOW' ELSE 'DENY' END;
            WHEN 'INSERT', 'UPDATE', 'DELETE' THEN
                v_result := CASE WHEN v_count > 0 THEN 'ALLOW' ELSE 'DENY' END;
            ELSE
                v_result := 'COMPLETED';
        END CASE;
        
    EXCEPTION WHEN OTHERS THEN
        v_result := 'DENY';
        v_error := SQLERRM;
    END;
    
    INSERT INTO rls_test_results (user_role, table_name, operation, expected_result, actual_result, test_status, error_message)
    VALUES (
        p_user_role, 
        p_table_name, 
        p_operation, 
        p_expected, 
        v_result,
        CASE WHEN v_result = p_expected THEN 'PASS' ELSE 'FAIL' END,
        v_error
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TEST ADMIN A (Household Owner) - Should have full access to own household
-- =============================================================================

-- Simulate Admin A context
SET LOCAL ROLE postgres;
SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- Test households table access
SELECT test_rls_operation(
    'Admin A', 'households', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM households WHERE id = ''' || :'household_1' || ''''
);

SELECT test_rls_operation(
    'Admin A', 'households', 'UPDATE', 'ALLOW', 
    'UPDATE households SET name = ''QA Test Primary Updated'' WHERE id = ''' || :'household_1' || ''''
);

-- Test household_members access (own household)
SELECT test_rls_operation(
    'Admin A', 'household_members', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM household_members WHERE household_id = ''' || :'household_1' || ''''
);

SELECT test_rls_operation(
    'Admin A', 'household_members', 'INSERT', 'ALLOW',
    'INSERT INTO household_members (household_id, user_id, role) VALUES (''' || :'household_1' || ''', gen_random_uuid(), ''FAMILY_MEMBER'') ON CONFLICT DO NOTHING'
);

-- Test cross-household access (should be denied)
SELECT test_rls_operation(
    'Admin A', 'household_members', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM household_members WHERE household_id = ''' || :'household_2' || ''''
);

-- Test relatives access
SELECT test_rls_operation(
    'Admin A', 'relatives', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM relatives WHERE household_id = ''' || :'household_1' || ''''
);

SELECT test_rls_operation(
    'Admin A', 'relatives', 'INSERT', 'ALLOW',
    'INSERT INTO relatives (household_id, first_name, last_name) VALUES (''' || :'household_1' || ''', ''Test'', ''Relative'') ON CONFLICT DO NOTHING'
);

-- Test family_messages access
SELECT test_rls_operation(
    'Admin A', 'family_messages', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM family_messages WHERE household_id = ''' || :'household_1' || ''''
);

SELECT test_rls_operation(
    'Admin A', 'family_messages', 'INSERT', 'ALLOW',
    'INSERT INTO family_messages (household_id, sender_id, content) VALUES (''' || :'household_1' || ''', ''' || :'admin_a' || ''', ''Test message'') ON CONFLICT DO NOTHING'
);

-- Test family_photos access
SELECT test_rls_operation(
    'Admin A', 'family_photos', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM family_photos WHERE household_id = ''' || :'household_1' || ''''
);

-- Test invites management
SELECT test_rls_operation(
    'Admin A', 'invites', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM invites WHERE household_id = ''' || :'household_1' || ''''
);

SELECT test_rls_operation(
    'Admin A', 'invites', 'INSERT', 'ALLOW',
    'INSERT INTO invites (household_id, email, role, token, invited_by, expires_at) VALUES (''' || :'household_1' || ''', ''test.rls@example.com'', ''viewer'', ''test-token-rls'', ''' || :'admin_a' || ''', NOW() + INTERVAL ''7 days'') ON CONFLICT DO NOTHING'
);

-- =============================================================================
-- TEST MEMBER B (Family Member with Health Access)
-- =============================================================================

SET LOCAL "request.jwt.claims" TO '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

-- Should be able to view household data
SELECT test_rls_operation(
    'Member B', 'households', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM households WHERE id = ''' || :'household_1' || ''''
);

-- Should NOT be able to update household
SELECT test_rls_operation(
    'Member B', 'households', 'UPDATE', 'DENY',
    'UPDATE households SET name = ''Should Fail'' WHERE id = ''' || :'household_1' || ''''
);

-- Should be able to view household members
SELECT test_rls_operation(
    'Member B', 'household_members', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM household_members WHERE household_id = ''' || :'household_1' || ''''
);

-- Should NOT be able to add household members (admin only)
SELECT test_rls_operation(
    'Member B', 'household_members', 'INSERT', 'DENY',
    'INSERT INTO household_members (household_id, user_id, role) VALUES (''' || :'household_1' || ''', gen_random_uuid(), ''FAMILY_MEMBER'')'
);

-- Should be able to view relatives
SELECT test_rls_operation(
    'Member B', 'relatives', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM relatives WHERE household_id = ''' || :'household_1' || ''''
);

-- Should NOT be able to add relatives (typically admin only)
SELECT test_rls_operation(
    'Member B', 'relatives', 'INSERT', 'DENY',
    'INSERT INTO relatives (household_id, first_name, last_name) VALUES (''' || :'household_1' || ''', ''Should'', ''Fail'')'
);

-- Should be able to send messages
SELECT test_rls_operation(
    'Member B', 'family_messages', 'INSERT', 'ALLOW',
    'INSERT INTO family_messages (household_id, sender_id, content) VALUES (''' || :'household_1' || ''', ''' || :'member_b' || ''', ''Member B test message'') ON CONFLICT DO NOTHING'
);

-- Should be able to view messages
SELECT test_rls_operation(
    'Member B', 'family_messages', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM family_messages WHERE household_id = ''' || :'household_1' || ''''
);

-- Should NOT be able to access other household data
SELECT test_rls_operation(
    'Member B', 'family_messages', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM family_messages WHERE household_id = ''' || :'household_2' || ''''
);

-- =============================================================================
-- TEST MEMBER C (Family Member without Health Access)
-- =============================================================================

SET LOCAL "request.jwt.claims" TO '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';

-- Basic household access should work
SELECT test_rls_operation(
    'Member C', 'household_members', 'SELECT', 'ALLOW',
    'SELECT COUNT(*) FROM household_members WHERE household_id = ''' || :'household_1' || ''' AND user_id = ''' || :'member_c' || ''''
);

-- Should be able to send messages
SELECT test_rls_operation(
    'Member C', 'family_messages', 'INSERT', 'ALLOW',
    'INSERT INTO family_messages (household_id, sender_id, content) VALUES (''' || :'household_1' || ''', ''' || :'member_c' || ''', ''Member C test message'') ON CONFLICT DO NOTHING'
);

-- Should NOT have access to health data (if call_analysis exists)
SELECT test_rls_operation(
    'Member C', 'call_analysis', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM call_analysis WHERE user_id IN (SELECT id FROM relatives WHERE household_id = ''' || :'household_1' || ''')'
);

-- =============================================================================
-- TEST CROSS-HOUSEHOLD ACCESS (All users)
-- =============================================================================

-- Admin A should NOT access household 2
SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

SELECT test_rls_operation(
    'Admin A', 'households', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM households WHERE id = ''' || :'household_2' || ''''
);

SELECT test_rls_operation(
    'Admin A', 'relatives', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM relatives WHERE household_id = ''' || :'household_2' || ''''
);

-- Member B should NOT access household 2
SET LOCAL "request.jwt.claims" TO '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

SELECT test_rls_operation(
    'Member B', 'family_messages', 'INSERT', 'DENY',
    'INSERT INTO family_messages (household_id, sender_id, content) VALUES (''' || :'household_2' || ''', ''' || :'member_b' || ''', ''Should fail'')'
);

-- =============================================================================
-- TEST UNAUTHENTICATED ACCESS (No JWT)
-- =============================================================================

SET LOCAL "request.jwt.claims" TO NULL;

-- All operations should be denied for unauthenticated users
SELECT test_rls_operation(
    'Unauthenticated', 'households', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM households'
);

SELECT test_rls_operation(
    'Unauthenticated', 'relatives', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM relatives'
);

SELECT test_rls_operation(
    'Unauthenticated', 'family_messages', 'SELECT', 'DENY',
    'SELECT COUNT(*) FROM family_messages'
);

-- =============================================================================
-- GENERATE TEST REPORT
-- =============================================================================

-- Summary by status
SELECT 
    test_status,
    COUNT(*) as test_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM rls_test_results), 2) as percentage
FROM rls_test_results
GROUP BY test_status
ORDER BY test_count DESC;

-- Failed tests detail
SELECT 
    user_role,
    table_name, 
    operation,
    expected_result,
    actual_result,
    error_message
FROM rls_test_results 
WHERE test_status = 'FAIL'
ORDER BY user_role, table_name, operation;

-- Full test results
SELECT 
    test_id,
    user_role,
    table_name,
    operation, 
    expected_result,
    actual_result,
    test_status,
    CASE WHEN error_message IS NOT NULL THEN LEFT(error_message, 100) ELSE NULL END as error_summary
FROM rls_test_results
ORDER BY test_id;

-- Test summary by user role and table
SELECT 
    user_role,
    table_name,
    COUNT(*) as total_tests,
    SUM(CASE WHEN test_status = 'PASS' THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN test_status = 'FAIL' THEN 1 ELSE 0 END) as failed
FROM rls_test_results
GROUP BY user_role, table_name
ORDER BY user_role, table_name;

-- Critical security checks
WITH security_violations AS (
    SELECT * FROM rls_test_results
    WHERE test_status = 'FAIL' 
    AND (
        (operation = 'SELECT' AND expected_result = 'DENY' AND actual_result = 'ALLOW') OR
        (operation IN ('INSERT', 'UPDATE', 'DELETE') AND expected_result = 'DENY' AND actual_result = 'ALLOW')
    )
)
SELECT 
    COUNT(*) as critical_violations,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ NO CRITICAL SECURITY VIOLATIONS DETECTED'
        ELSE '🚨 CRITICAL: ' || COUNT(*) || ' SECURITY VIOLATIONS FOUND - REVIEW IMMEDIATELY'
    END as security_status
FROM security_violations;

-- Drop helper function
DROP FUNCTION test_rls_operation(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Instructions for manual verification
SELECT '
=============================================================================
RLS VERIFICATION COMPLETE
=============================================================================

Next Steps:
1. Review failed tests above - especially any with expected DENY but actual ALLOW
2. Critical security violations (if any) must be fixed before production
3. Run this script with different user contexts to verify auth.uid() behavior
4. Test with actual authenticated users via application UI

To test with real users:
1. Login as each test user in the application
2. Attempt cross-household access via developer tools
3. Verify API responses match RLS expectations

Remember: RLS is your last line of defense - ensure it works correctly!
' as instructions;