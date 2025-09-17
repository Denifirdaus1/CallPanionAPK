# Test Data Seeding Instructions

## Overview
This directory contains SQL scripts to populate the CallPanion database with comprehensive test data for QA validation.

## Prerequisites
- Access to Supabase dashboard or SQL editor
- Service role permissions for data manipulation
- Clean test environment (or willingness to overwrite existing test data)

## Files
- `01_test_data.sql` - Main seeding script with all test entities

## Test Accounts Required
Before running the seed scripts, ensure these test user accounts exist in Supabase Auth:

```
admin.test@callpanion.com     (Admin A - Household Owner)
member.test@callpanion.com    (Member B - Family Member with health access)
member2.test@callpanion.com   (Member C - Family Member without health access)  
elderly.test@callpanion.com   (Elderly C - Relative)
elderly2.test@callpanion.com  (Elderly D - Secondary relative)
pending.test@callpanion.com   (Pending D - For invite testing)
```

### User ID Mapping
The seed script uses these specific UUIDs that must match your auth.users table:

```sql
'22222222-2222-2222-2222-222222222222' -- admin.test@callpanion.com
'77777777-7777-7777-7777-777777777777' -- member.test@callpanion.com  
'99999999-9999-9999-9999-999999999999' -- member2.test@callpanion.com
'44444444-4444-4444-4444-444444444444' -- Secondary household admin
```

## How to Apply Seeds

### Method 1: Supabase Dashboard (Recommended)
1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy and paste contents of `01_test_data.sql`
5. Click "Run" to execute

### Method 2: Command Line (if psql available)
```bash
# From project root
psql "postgresql://postgres:[password]@[host]:5432/postgres" -f qa/seed/01_test_data.sql
```

### Method 3: Supabase CLI
```bash
supabase db reset --local  # If using local dev
# Then run seed script via dashboard
```

## What Gets Created

### Households (2)
- **QA Test Primary Household**: Main test household with full feature set
- **QA Test Secondary Household**: For cross-household access testing

### Users & Roles (4 active + 1 pending)
- **Admin A**: Primary household owner with full permissions
- **Member B**: Family member with health insights access
- **Member C**: Family member without health insights access  
- **Admin D**: Secondary household owner
- **Pending D**: Pending invite for acceptance testing

### Relatives (3)
- **Eleanor Johnson**: Primary household elderly user
- **George Smith**: Secondary elderly user in primary household
- **Margaret Wilson**: Elderly user in secondary household

### Content
- **8 Family Messages**: Various types and timestamps
- **10 Family Photos**: With captions, likes, and metadata
- **5 Call Logs**: Mix of completed/missed with different outcomes
- **4 Call Analysis**: Health insights with mood scores and flags

### Invites (2)
- **Valid Invite**: Active invite for testing acceptance flow
- **Expired Invite**: For testing error handling

## Verification Queries

Run these to confirm successful seeding:

```sql
-- Check household creation
SELECT name, created_by FROM households WHERE name LIKE 'QA Test%';

-- Check user roles
SELECT h.name, hm.role, hm.health_access_level 
FROM household_members hm
JOIN households h ON h.id = hm.household_id
WHERE h.name LIKE 'QA Test%';

-- Check relatives
SELECT h.name as household, r.first_name, r.last_name
FROM relatives r  
JOIN households h ON h.id = r.household_id
WHERE h.name LIKE 'QA Test%';

-- Check messages and photos
SELECT 
  (SELECT COUNT(*) FROM family_messages fm 
   JOIN households h ON h.id = fm.household_id 
   WHERE h.name LIKE 'QA Test%') as messages,
  (SELECT COUNT(*) FROM family_photos fp
   JOIN households h ON h.id = fp.household_id
   WHERE h.name LIKE 'QA Test%') as photos;
```

## Cleanup

To remove all test data:

```sql
-- WARNING: This deletes all QA test data
DELETE FROM family_photos WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM family_messages WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM call_analysis WHERE user_id IN (
    SELECT r.id FROM relatives r 
    JOIN households h ON r.household_id = h.id 
    WHERE h.name LIKE 'QA Test%'
);
DELETE FROM call_logs WHERE user_id IN (
    SELECT r.id FROM relatives r 
    JOIN households h ON r.household_id = h.id 
    WHERE h.name LIKE 'QA Test%'
);
DELETE FROM invites WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM household_members WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM relatives WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM households WHERE name LIKE 'QA Test%';
```

## Troubleshooting

### Foreign Key Errors
- Ensure auth.users records exist before running seeds
- Check user UUIDs match between auth.users and seed script

### Permission Errors  
- Use service role key when running via API
- Ensure RLS policies allow the operation for your role

### Duplicate Key Errors
- Run cleanup script first if re-seeding
- Check for existing data with similar names/IDs

## Next Steps
After successful seeding:
1. Run RLS verification tests (`qa/rls/rls_checks.sql`)
2. Execute Playwright E2E test suite
3. Verify all user accounts can authenticate
4. Test cross-household access restrictions