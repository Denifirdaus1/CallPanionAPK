# CallPanion QA Testing Framework

🧪 Comprehensive quality assurance framework for the CallPanion family care platform.

## Overview

This QA framework provides end-to-end testing, security validation, and database integrity checks for CallPanion. It covers all user types and critical workflows to ensure the platform works correctly and securely.

## Quick Start

```bash
# 1. Ensure your application is running
npm run dev

# 2. Run the complete test suite
./qa/run-tests.sh

# 3. View results
open qa/reports/playwright-report/index.html
```

## Framework Structure

```
qa/
├── plan.md                    # Comprehensive QA test plan
├── seed/                      # Test data setup
│   ├── 01_test_data.sql      # SQL script for test data
│   └── README.md             # Seeding instructions
├── rls/                      # Row Level Security tests
│   └── rls_checks.sql        # Database security verification
├── e2e/                      # End-to-end tests
│   ├── tests/                # Test specifications
│   ├── playwright.config.ts  # Test configuration
│   └── package.json          # Test dependencies
├── reports/                  # Generated test reports
└── run-tests.sh              # Test execution script
```

## Test Coverage

### 🔐 Authentication & Authorization
- **A001-A006**: Login/signup flows, waitlist forms, validation
- **H001-H010**: Security controls, RLS enforcement, session management

### 👨‍💼 Family Admin Features  
- **B001-B006**: Household creation, relative management, messaging, health insights

### 👤 Family Member Features
- **C001-C007**: Limited permissions, messaging, role restrictions

### 👵 Elderly User Interface
- **D001-D008**: Simplified UI, message viewing, accessibility features

### 📧 Invite System
- **E001-E007**: Magic links, account creation, role assignment, GDPR compliance

## User Roles Tested

| Role | Email | Permissions | Test Coverage |
|------|-------|-------------|---------------|
| **Family Admin** | admin.test@callpanion.com | Full household management | B001-B006 |
| **Family Member** | member.test@callpanion.com | Limited access, messaging | C001-C007 |  
| **Elderly User** | elderly.test@callpanion.com | View messages/photos only | D001-D008 |
| **Pending User** | pending.test@callpanion.com | Invite acceptance flow | E001-E007 |
| **Unauthenticated** | - | Public pages only | A001-A002 |

## Prerequisites

### Required Test Accounts
Create these user accounts in your Supabase Auth before running tests:

```sql
-- Insert into auth.users (handle via Supabase dashboard or auth signup)
admin.test@callpanion.com     -- UUID: 22222222-2222-2222-2222-222222222222
member.test@callpanion.com    -- UUID: 77777777-7777-7777-7777-777777777777  
member2.test@callpanion.com   -- UUID: 99999999-9999-9999-9999-999999999999
elderly.test@callpanion.com   -- For elderly interface testing
```

### Environment Setup
1. **Development Server**: Application running on `localhost:5173`
2. **Database**: Supabase with test data seeded
3. **Node.js**: Version 18+ with npm
4. **Playwright**: Browsers installed

## Running Tests

### Complete Test Suite
```bash
# Run everything with reporting
./qa/run-tests.sh
```

### Individual Test Categories
```bash
cd qa/e2e

# Authentication tests
npm run test:auth

# Admin functionality  
npm run test:admin

# Member permissions
npm run test:member

# Elderly interface
npm run test:elderly

# Invite flow
npm run test:invite

# Security validation
npm run test:security
```

### Debug Mode
```bash
cd qa/e2e

# Run with browser visible
npm run test:headed

# Interactive debugging
npm run test:debug

# Visual test runner
npm run test:ui
```

## Test Data Setup

### 1. Seed Database
```bash
# Via Supabase Dashboard SQL Editor:
# Copy and run: qa/seed/01_test_data.sql

# Or via psql:
psql "your-connection-string" -f qa/seed/01_test_data.sql
```

### 2. Verify Data
```sql
-- Check test households created
SELECT name, created_by FROM households WHERE name LIKE 'QA Test%';

-- Check test members
SELECT h.name, hm.role, hm.health_access_level 
FROM household_members hm
JOIN households h ON h.id = hm.household_id
WHERE h.name LIKE 'QA Test%';
```

## Security Testing

### Row Level Security (RLS) Verification
```bash
# Run via Supabase SQL Editor:
# qa/rls/rls_checks.sql

# This will test:
# - Cross-household access prevention
# - Role-based permissions
# - Health data access controls
# - Authentication requirements
```

### Security Test Coverage
- ✅ Authentication bypass attempts
- ✅ Cross-household data access
- ✅ Role privilege escalation  
- ✅ Session management
- ✅ Input validation (XSS, SQLi)
- ✅ File upload restrictions
- ✅ Rate limiting
- ✅ Sensitive data exposure

## Reports & Debugging

### Generated Reports
- **HTML Report**: `qa/reports/playwright-report/index.html` (Interactive)
- **JSON Results**: `qa/reports/test-results.json` (Machine readable)
- **JUnit XML**: `qa/reports/test-results.xml` (CI/CD integration)
- **Summary**: `qa/reports/summary.json` (High-level stats)

### Debugging Failed Tests
1. **Screenshots**: Available in `qa/reports/test-results/`
2. **Videos**: Recorded for failed tests
3. **Traces**: Interactive debugging via Playwright
4. **Console Logs**: Browser console output captured

```bash
# View specific test failure
npx playwright show-trace qa/reports/test-results/test-name/trace.zip

# Open detailed report
npx playwright show-report qa/reports/playwright-report
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: QA Tests
on: [push, pull_request]
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: ./qa/run-tests.sh
      - uses: actions/upload-artifact@v3
        with:
          name: qa-reports
          path: qa/reports/
```

## Customization

### Adding New Tests
1. Create test file in `qa/e2e/tests/`
2. Follow naming convention: `feature.spec.ts`
3. Use Page Object Model for reusable components
4. Add data-testid attributes for reliable selectors

### Test Configuration
Edit `qa/e2e/playwright.config.ts`:
- Timeout settings
- Browser configuration  
- Reporter options
- Base URL and environment

### Environment Variables
```bash
# Optional configuration
export QA_BASE_URL=http://localhost:5173
export QA_TIMEOUT=30000
export QA_RETRIES=2
export QA_BROWSER=chromium
```

## Troubleshooting

### Common Issues

**Tests fail with "Element not found"**
- Check if UI elements have changed
- Verify data-testid attributes exist
- Increase timeout values if needed

**Authentication tests fail**  
- Verify test user accounts exist in Supabase Auth
- Check email/password credentials
- Ensure auth redirects work correctly

**Database tests fail**
- Run seed script to populate test data
- Verify RLS policies are enabled
- Check user UUIDs match between auth.users and test data

**Performance issues**
- Reduce parallel test workers
- Increase timeout values
- Check development server performance

### Getting Help

1. **Review test plan**: `qa/plan.md` for detailed requirements
2. **Check reports**: HTML report shows detailed failure information
3. **Debug interactively**: Use `npm run test:debug` for step-through debugging
4. **Verify setup**: Ensure test data and accounts are properly configured

## Success Criteria

✅ **Pass Rate**: >95% of tests pass  
✅ **Security**: 0 unauthorized data access incidents  
✅ **Coverage**: All critical user journeys tested  
✅ **Performance**: Page loads <3s, interactions <1s  

## Contributing

When adding new features to CallPanion:

1. **Add test coverage** for new functionality
2. **Update seed data** if new database entities are added  
3. **Review security implications** and add appropriate tests
4. **Document test scenarios** in the relevant spec files

---

🎯 **Ready to test?** Run `./qa/run-tests.sh` and ensure your CallPanion platform is rock solid!