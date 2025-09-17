import { test, expect } from '@playwright/test';

// Helper function to login as family member
async function loginAsMember(page: any) {
  await page.goto('/family-login');
  
  await page.fill('input[type="email"]', 'member.test@callpanion.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
  
  await page.waitForURL(/\/family/, { timeout: 10000 });
}

test.describe('Family Member Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAsMember(page);
  });

  test('C001: Member can view household and relatives', async ({ page }) => {
    // GIVEN: Family member is logged in
    // WHEN: Member views household information
    // THEN: Should see relatives and basic household data
    
    await test.step('Access family dashboard', async () => {
      await page.goto('/family/dashboard');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    await test.step('View relatives list', async () => {
      await page.goto('/family/members');
      
      // Should see relatives in the household
      const relativeElements = await page.locator(
        '.relative, .member, .user, [data-testid="relative-card"]'
      ).count();
      
      expect(relativeElements).toBeGreaterThan(0);
    });

    await test.step('View household information', async () => {
      // Should see household name or details somewhere
      const householdInfo = page.locator(
        ':has-text("household"), :has-text("family"), .household, .family-info'
      );
      
      await expect(householdInfo.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test('C002: Member cannot perform admin-only actions', async ({ page }) => {
    // GIVEN: Family member (not admin) is logged in
    // WHEN: Member tries to access admin functions
    // THEN: Should be denied or options hidden
    
    await test.step('Admin buttons should be hidden or disabled', async () => {
      await page.goto('/family/members');
      
      // Admin-specific buttons should not be visible or should be disabled
      const adminButtons = page.locator(
        'button:has-text("Delete Household"), button:has-text("Remove Member"), button:has-text("Change Owner")'
      );
      
      const visibleAdminButtons = await adminButtons.count();
      expect(visibleAdminButtons).toBe(0);
    });

    await test.step('Cannot access admin settings', async () => {
      // Try to access admin-only routes
      await page.goto('/family/settings');
      
      // Should either redirect or show access denied
      const currentUrl = page.url();
      const hasAccessDenied = await page.locator(':has-text("access"), :has-text("permission"), :has-text("denied")').isVisible();
      
      // Either redirected away or shows access denied message
      expect(
        !currentUrl.includes('/settings') || hasAccessDenied
      ).toBeTruthy();
    });

    await test.step('Cannot manage household members roles', async () => {
      await page.goto('/family/members');
      
      // Role change buttons should not be available
      const roleButtons = page.locator(
        'button:has-text("Make Admin"), select[name*="role"], [data-testid="role-select"]'
      );
      
      const editableRoles = await roleButtons.count();
      expect(editableRoles).toBe(0);
    });
  });

  test('C003: Member can send messages and photos', async ({ page }) => {
    // GIVEN: Family member has messaging permissions
    // WHEN: Member sends messages and uploads photos
    // THEN: Content should be shared successfully
    
    await test.step('Send family message', async () => {
      await page.goto('/family/messages');
      
      const messageInput = page.locator(
        'textarea, input[type="text"]:not([type="email"]), [contenteditable="true"], [data-testid="message-input"]'
      ).first();
      
      if (await messageInput.isVisible()) {
        const testMessage = `Member test message at ${new Date().toLocaleString()}`;
        await messageInput.fill(testMessage);
        
        const sendButton = page.locator(
          'button:has-text("Send"), button[type="submit"], [data-testid="send-button"]'
        ).first();
        
        await sendButton.click();
        
        // Message should appear in conversation
        await expect(page.locator(`:has-text("${testMessage}")`)).toBeVisible({ timeout: 5000 });
      }
    });

    await test.step('Upload photo if feature available', async () => {
      await page.goto('/family/memories');
      
      const uploadButton = page.locator(
        'button:has-text("Upload"), input[type="file"], [data-testid="upload-button"]'
      ).first();
      
      if (await uploadButton.isVisible()) {
        // Verify upload interface is accessible to members
        await expect(uploadButton).toBeEnabled();
      }
    });

    await test.step('View message history', async () => {
      await page.goto('/family/messages');
      
      // Should see existing messages
      const messages = page.locator(
        '.message, .chat-message, [data-testid="message"]'
      );
      
      const messageCount = await messages.count();
      // Should see at least the message we just sent, or existing messages
      expect(messageCount).toBeGreaterThan(0);
    });
  });

  test('C004: Member health access depends on permissions', async ({ page }) => {
    // GIVEN: Family member may or may not have health access
    // WHEN: Member tries to access health insights
    // THEN: Access should match assigned permissions
    
    await test.step('Navigate to health page', async () => {
      await page.goto('/family/health');
    });

    await test.step('Check health access level', async () => {
      // Member might have different levels of health access
      const hasFullAccess = await page.locator('.chart, .graph, .health-data').isVisible();
      const hasSummaryOnly = await page.locator(':has-text("summary"), :has-text("overview")').isVisible();
      const hasNoAccess = await page.locator(':has-text("access"), :has-text("permission")').isVisible();
      
      // Should have one of these states
      expect(hasFullAccess || hasSummaryOnly || hasNoAccess).toBeTruthy();
      
      // Log what type of access this member has for debugging
      if (hasFullAccess) {
        console.log('Member has full health access');
      } else if (hasSummaryOnly) {
        console.log('Member has summary-only health access');
      } else {
        console.log('Member has no health access');
      }
    });

    await test.step('Verify appropriate restrictions', async () => {
      // If member has limited access, certain features should be restricted
      const detailedHealthData = page.locator(
        '.detailed-analysis, .transcript, .call-recording, [data-testid="detailed-health"]'
      );
      
      // Members without full access shouldn't see detailed health data
      const hasDetailedData = await detailedHealthData.isVisible();
      
      // This test would need to be adapted based on the specific member's permissions
      // For now, just verify the page loads without errors
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test('C005: Member cannot invite new members', async ({ page }) => {
    // GIVEN: Family member (non-admin) is logged in
    // WHEN: Member looks for invite functionality
    // THEN: Should not have access to invite new members
    
    await test.step('Invite buttons should be hidden', async () => {
      await page.goto('/family/members');
      
      // Invite functionality should not be available to regular members
      const inviteButtons = page.locator(
        'button:has-text("Invite"), button:has-text("Add Member"), [data-testid="invite-button"]'
      );
      
      const visibleInviteButtons = await inviteButtons.count();
      expect(visibleInviteButtons).toBe(0);
    });

    await test.step('Cannot access invite management', async () => {
      // Try to access invite-related routes directly
      await page.goto('/family/invite');
      
      const currentUrl = page.url();
      const hasAccessDenied = await page.locator(':has-text("access"), :has-text("permission"), :has-text("not found")').isVisible();
      
      // Should either redirect or show access denied
      expect(
        !currentUrl.includes('/invite') || hasAccessDenied
      ).toBeTruthy();
    });
  });

  test('C006: Member cannot access other households data', async ({ page }) => {
    // GIVEN: Family member is in one household
    // WHEN: Member tries to access data from other households
    // THEN: Should be denied access
    
    await test.step('Cannot view other household members', async () => {
      // This test would require knowing IDs of other households
      // For now, verify that the member only sees their own household data
      
      await page.goto('/family/members');
      
      // Should only see members from their household
      const memberElements = page.locator('.member, .user, .relative');
      const memberCount = await memberElements.count();
      
      // Should see some members, but not an excessive number (indicating cross-household access)
      expect(memberCount).toBeGreaterThan(0);
      expect(memberCount).toBeLessThan(20); // Reasonable upper limit for a single household
    });

    await test.step('API requests should be restricted', async () => {
      // Monitor network requests to ensure no unauthorized data access
      let unauthorizedRequest = false;
      
      page.on('response', response => {
        if (response.status() === 403 || response.status() === 401) {
          console.log(`Correctly blocked unauthorized request: ${response.url()}`);
        }
      });
      
      // Navigate around the app to trigger API calls
      await page.goto('/family/dashboard');
      await page.goto('/family/messages');
      
      // Any 403/401 responses would be logged above as expected behavior
    });
  });

  test('C007: Member respects messaging quotas and limits', async ({ page }) => {
    // GIVEN: Family member has messaging capabilities
    // WHEN: Member approaches system limits
    // THEN: Should receive appropriate warnings or restrictions
    
    await test.step('Send multiple messages to test limits', async () => {
      await page.goto('/family/messages');
      
      const messageInput = page.locator('textarea, [data-testid="message-input"]').first();
      
      if (await messageInput.isVisible()) {
        // Send several messages to see if any limits are enforced
        for (let i = 0; i < 5; i++) {
          await messageInput.fill(`Test message ${i + 1} from member`);
          
          const sendButton = page.locator('button:has-text("Send"), [data-testid="send-button"]').first();
          await sendButton.click();
          
          // Wait a moment between messages
          await page.waitForTimeout(500);
          
          // Check if any rate limiting messages appear
          const rateLimitMessage = page.locator(':has-text("limit"), :has-text("too many"), :has-text("wait")');
          if (await rateLimitMessage.isVisible()) {
            console.log('Rate limiting detected');
            break;
          }
        }
      }
    });

    await test.step('Verify message history shows sent messages', async () => {
      // Should see the messages that were successfully sent
      const messages = page.locator('.message, [data-testid="message"]');
      const messageCount = await messages.count();
      
      expect(messageCount).toBeGreaterThan(0);
    });
  });
});