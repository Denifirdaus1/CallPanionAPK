# CallPanion QA Test Plan

## Overview
Comprehensive end-to-end validation of the CallPanion family care platform covering all user types and critical workflows.

## System Architecture
- **Frontend**: React/TypeScript with Supabase integration
- **Backend**: Supabase with Row Level Security (RLS)
- **Authentication**: Supabase Auth with magic links and email/password
- **Storage**: Family photos and media via Supabase Storage

## User Roles & Permissions

### 1. Family Admin (Household Owner)
- **Permissions**: Full CRUD on household, relatives, members, messages, photos
- **Special Access**: Health insights, invite management, member role changes
- **Database Role**: `FAMILY_PRIMARY` in household_members table

### 2. Family Member (Non-owner)
- **Permissions**: View household, send messages/photos, limited relative access
- **Restrictions**: Cannot delete household, limited health access unless granted
- **Database Role**: `FAMILY_MEMBER` in household_members table

### 3. Elderly User (Lite App)
- **Permissions**: View messages/photos sent to them, basic interface
- **Restrictions**: No health insights, no household management
- **Database Role**: Linked via relatives table

### 4. Invited Pending User
- **Status**: Pre-signup with valid invite token
- **Flow**: Magic link → account creation → household join

### 5. Unauthenticated Visitor
- **Access**: Marketing pages only
- **Restrictions**: All app routes require authentication

## Test Environment Configuration

### Base URLs
- **Marketing**: `/` (CallPanionLanding)
- **Family Dashboard**: `/family/*`
- **Elderly Interface**: `/elder`
- **Authentication**: `/family-login`, `/admin-login`

### Test Accounts
```
Admin A (Owner):     admin.test@callpanion.com
Member B:            member.test@callpanion.com  
Elderly C:           elderly.test@callpanion.com
Pending D:           pending.test@callpanion.com
```

### Database Tables (Key)
- `households` - Family units
- `household_members` - User-household relationships with roles
- `relatives` - Elderly persons linked to households
- `family_messages` - Messages between family members
- `family_photos` - Shared family photos
- `call_logs` - AI call records
- `call_analysis` - Health insights from calls
- `invites` - Pending user invitations

## Test Scope

### In Scope
✅ Authentication flows (login/signup/magic links)
✅ Household management (create/join/leave)
✅ Relative management (CRUD operations)
✅ Family member invitation and role management
✅ Messaging and photo sharing
✅ Health insights access control
✅ Row Level Security enforcement
✅ Error handling and edge cases
✅ Basic accessibility compliance

### Out of Scope
❌ Email delivery testing (mock/stub)
❌ AI call functionality (external service)
❌ Payment processing
❌ Mobile app native features
❌ Performance testing
❌ Browser compatibility (Chrome only)

## Acceptance Criteria

### Functional
1. **Authentication**: All user types can authenticate via their intended method
2. **Authorization**: RLS policies correctly enforce data access restrictions
3. **CRUD Operations**: All create/read/update/delete operations work as designed
4. **Invite Flow**: Magic link generation and acceptance creates proper relationships
5. **Health Data**: Access controls properly restrict sensitive information

### Security
1. **Cross-Household Access**: Users cannot access data from other households
2. **Role Enforcement**: Users cannot perform actions outside their role permissions
3. **PII Protection**: No sensitive data exposed in client logs or responses

### UX/Accessibility
1. **Error Handling**: Graceful error messages for all failure scenarios
2. **Navigation**: All primary flows are keyboard accessible
3. **Feedback**: Users receive clear confirmation of actions

## Test Data Requirements

### Households
- 1 primary test household with full data set
- 1 secondary household for cross-access testing

### Users
- 1 household admin (owner)
- 2 family members (one with health access, one without)
- 2 elderly users
- 1 pending invite

### Content
- 8 family messages (various types)
- 10 family photos (different sizes/formats)
- 5 call log entries with analysis
- 3 upcoming events/appointments

## Risk Assessment

### High Risk
- RLS policy bypass allowing cross-household data access
- Authentication token manipulation
- Health data exposure to unauthorized users

### Medium Risk
- Invite token manipulation or reuse
- File upload vulnerabilities
- Rate limiting bypass

### Low Risk
- UI responsiveness issues
- Minor validation gaps
- Non-critical error message clarity

## Test Execution Strategy

### Phase 1: Smoke Tests
- Basic authentication and navigation
- Critical user flows (add relative, send message)
- RLS basic enforcement

### Phase 2: Feature Tests  
- Complete CRUD operations for all entities
- Role-based access control validation
- Error handling scenarios

### Phase 3: Security Tests
- Cross-household access attempts
- Token manipulation attempts
- SQL injection prevention

### Phase 4: Integration Tests
- End-to-end user workflows
- Multi-user scenarios
- Data consistency validation

## Success Metrics
- **Pass Rate**: >95% of automated tests pass
- **Security**: 0 unauthorized data access incidents
- **Coverage**: All critical user journeys tested
- **Performance**: Page loads <3s, interactions <1s response

## Reporting
- Automated test results with screenshots
- Security audit summary
- Performance baseline measurements
- Accessibility compliance report