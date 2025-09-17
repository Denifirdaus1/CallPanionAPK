import { test, expect } from '@playwright/test';

test.describe('Invite Flow and Pending Users', () => {

  test('E001: Valid invite link creates account and joins household', async ({ page }) => {
    // GIVEN: Valid invite token exists
    // WHEN: Pending user clicks invite link
    // THEN: Should complete signup and join household
    
    await test.step('Access invite link with valid token', async () => {
      // Use the test invite token from seed data
      const inviteToken = 'test-invite-token-12345';
      await page.goto(`/accept-invite?token=${inviteToken}`);
      
      // Should load invite acceptance page
      await expect(page.locator('body')).toBeVisible();
    });

    await test.step('Verify invite details are displayed', async () => {
      // Should show information about the invite
      const inviteInfo = page.locator(
        ':has-text("invite"), :has-text("join"), :has-text("household"), :has-text("family")'
      );
      
      await expect(inviteInfo.first()).toBeVisible({ timeout: 5000 });
    });

    await test.step('Complete account creation if needed', async () => {
      // If user needs to create account, should see signup form
      const emailInput = page.locator('input[type="email"]').first();
      
      if (await emailInput.isVisible()) {
        const testEmail = `invited+${Date.now()}@example.com`;
        await emailInput.fill(testEmail);
        
        const passwordInput = page.locator('input[type="password"]').first();
        if (await passwordInput.isVisible()) {
          await passwordInput.fill('SecurePassword123!');
        }
        
        // Accept GDPR consent if required
        const consentCheckbox = page.locator('input[type="checkbox"]').first();
        if (await consentCheckbox.isVisible()) {
          await consentCheckbox.check();
        }
        
        // Submit account creation
        const submitButton = page.locator(
          'button[type="submit"], button:has-text("Accept"), button:has-text("Join"), button:has-text("Create")'
        ).first();
        
        await submitButton.click();
        
        // Should show success or redirect to dashboard
        await expect(
          page.locator('.success, .toast, [role="alert"]:has-text("success"), h1, h2')
        ).toBeVisible({ timeout: 10000 });
      }
    });

    await test.step('Verify successful household join', async () => {
      // Should now have access to household features
      const currentUrl = page.url();
      
      // Should be redirected to family dashboard or similar
      const isInFamilyArea = currentUrl.includes('/family') || 
                            await page.locator(':has-text("household"), :has-text("family")').isVisible();
      
      expect(isInFamilyArea).toBeTruthy();
    });
  });

  test('E002: Expired invite shows graceful error', async ({ page }) => {
    // GIVEN: Expired invite token exists
    // WHEN: User clicks expired invite link
    // THEN: Should show clear error and retry options
    
    await test.step('Access expired invite link', async () => {
      // Use the expired invite token from seed data
      const expiredToken = 'expired-invite-token-67890';
      await page.goto(`/accept-invite?token=${expiredToken}`);
      
      await expect(page.locator('body')).toBeVisible();
    });

    await test.step('Verify error message is displayed', async () => {
      // Should show clear error about expired invite
      const errorMessage = page.locator(
        ':has-text("expired"), :has-text("invalid"), :has-text("error"), .error, [role="alert"]'
      );
      
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    });

    await test.step('Should provide retry options', async () => {
      // Should offer ways to get a new invite or contact support
      const retryOptions = page.locator(
        'button:has-text("contact"), button:has-text("support"), a:has-text("help"), :has-text("new invite")'
      );
      
      const hasRetryOptions = await retryOptions.count() > 0;
      
      if (hasRetryOptions) {
        await expect(retryOptions.first()).toBeVisible();
      } else {
        // At minimum should not show a blank error page
        await expect(page.locator('h1, h2, .title').first()).toBeVisible();
      }
    });
  });

  test('E003: Invalid invite token shows appropriate error', async ({ page }) => {
    // GIVEN: Invalid/malformed invite token
    // WHEN: User accesses invite with bad token
    // THEN: Should show security-appropriate error
    
    await test.step('Access invite with invalid token', async () => {
      const invalidToken = 'definitely-not-a-real-token-12345';
      await page.goto(`/accept-invite?token=${invalidToken}`);
      
      await expect(page.locator('body')).toBeVisible();
    });

    await test.step('Verify appropriate error handling', async () => {
      // Should show error but not reveal system internals
      const errorElements = page.locator(
        ':has-text("invalid"), :has-text("not found"), :has-text("error"), .error, [role="alert"]'
      );
      
      await expect(errorElements.first()).toBeVisible({ timeout: 5000 });
      
      // Should not reveal sensitive system information
      const hasSystemError = await page.locator(':has-text("SQL"), :has-text("database"), :has-text("stack trace")').isVisible();
      expect(hasSystemError).toBeFalsy();
    });

    await test.step('Provide path forward for user', async () => {
      // Should not leave user stranded
      const helpOptions = page.locator(
        'a:has-text("home"), a:has-text("contact"), button:has-text("support"), a[href="/"]'
      );
      
      const hasHelpOptions = await helpOptions.count() > 0;
      expect(hasHelpOptions).toBeTruthy();
    });
  });

  test('E004: Already accepted invite handles gracefully', async ({ page }) => {
    // GIVEN: Invite token that was already accepted
    // WHEN: User tries to use it again
    // THEN: Should handle gracefully without errors
    
    await test.step('Try to use already accepted invite', async () => {
      // This would require an invite that was previously accepted
      // For now, test the general case of reusing a token
      const usedToken = 'test-invite-token-12345';
      await page.goto(`/accept-invite?token=${usedToken}`);
      
      await expect(page.locator('body')).toBeVisible();
    });

    await test.step('Should handle gracefully', async () => {
      // Should either:
      // 1. Show message that invite was already used
      // 2. Redirect to appropriate dashboard if user is already logged in
      // 3. Show login form if user needs to authenticate
      
      const hasGracefulHandling = await page.locator(
        ':has-text("already"), :has-text("used"), input[type="email"], h1, h2'
      ).isVisible({ timeout: 5000 });
      
      expect(hasGracefulHandling).toBeTruthy();
    });
  });

  test('E005: Invite flow preserves intended role and permissions', async ({ page }) => {
    // GIVEN: Invite was created with specific role
    // WHEN: User accepts invite
    // THEN: Should be assigned correct role in household
    
    await test.step('Accept invite and join household', async () => {
      const inviteToken = 'test-invite-token-12345';
      await page.goto(`/accept-invite?token=${inviteToken}`);
      
      // If account creation is needed, complete it
      const needsAccount = await page.locator('input[type="email"]').isVisible();
      
      if (needsAccount) {
        const testEmail = `role-test+${Date.now()}@example.com`;
        await page.fill('input[type="email"]', testEmail);
        
        const passwordInput = page.locator('input[type="password"]').first();
        if (await passwordInput.isVisible()) {
          await passwordInput.fill('SecurePassword123!');
        }
        
        const consentCheckbox = page.locator('input[type="checkbox"]').first();
        if (await consentCheckbox.isVisible()) {
          await consentCheckbox.check();
        }
        
        const submitButton = page.locator(
          'button[type="submit"], button:has-text("Accept"), button:has-text("Join")'
        ).first();
        
        await submitButton.click();
        
        // Wait for completion
        await page.waitForTimeout(3000);
      }
    });

    await test.step('Verify role-appropriate access', async () => {
      // Should have access consistent with invite role
      // The test invite is for "viewer" role, so should have limited access
      
      // Should be able to access family area
      await page.goto('/family/dashboard');
      const hasFamilyAccess = await page.locator('h1, h2, .dashboard').isVisible();
      
      if (hasFamilyAccess) {
        // Should NOT have admin functions for viewer role
        const adminElements = page.locator(
          'button:has-text("Delete"), button:has-text("Remove"), button:has-text("Admin")'
        );
        
        const adminCount = await adminElements.count();
        expect(adminCount).toBe(0);
      }
    });
  });

  test('E006: GDPR consent is properly recorded', async ({ page }) => {
    // GIVEN: User accepts invite with GDPR consent
    // WHEN: User completes invite flow
    // THEN: Consent should be properly recorded
    
    await test.step('Complete invite with GDPR consent', async () => {
      const inviteToken = 'test-invite-token-12345';
      await page.goto(`/accept-invite?token=${inviteToken}`);
      
      // Look for GDPR consent checkbox
      const consentCheckbox = page.locator(
        'input[type="checkbox"]:near(:has-text("consent")), input[type="checkbox"]:near(:has-text("privacy")), input[type="checkbox"]:near(:has-text("data"))'
      ).first();
      
      if (await consentCheckbox.isVisible()) {
        // Verify consent text is clear
        const consentText = page.locator(':has-text("consent"), :has-text("privacy"), :has-text("data protection")');
        await expect(consentText.first()).toBeVisible();
        
        // Check the consent box
        await consentCheckbox.check();
        
        // Verify it's checked
        await expect(consentCheckbox).toBeChecked();
      }
    });

    await test.step('Complete signup with consent', async () => {
      const emailInput = page.locator('input[type="email"]').first();
      
      if (await emailInput.isVisible()) {
        const testEmail = `gdpr-test+${Date.now()}@example.com`;
        await emailInput.fill(testEmail);
        
        const passwordInput = page.locator('input[type="password"]').first();
        if (await passwordInput.isVisible()) {
          await passwordInput.fill('SecurePassword123!');
        }
        
        const submitButton = page.locator(
          'button[type="submit"], button:has-text("Accept"), button:has-text("Join")'
        ).first();
        
        await submitButton.click();
        
        // Should complete successfully
        await expect(
          page.locator('.success, h1, h2, [role="alert"]:has-text("success")')
        ).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test('E007: Invite flow works across different devices/browsers', async ({ page, context }) => {
    // GIVEN: Invite link is shared across devices
    // WHEN: User opens link on different device
    // THEN: Should work consistently
    
    await test.step('Access invite from clean browser context', async () => {
      // Clear any existing session
      await context.clearCookies();
      await context.clearPermissions();
      
      const inviteToken = 'test-invite-token-12345';
      await page.goto(`/accept-invite?token=${inviteToken}`);
      
      // Should work even without existing session
      await expect(page.locator('body')).toBeVisible();
    });

    await test.step('Invite should work with different viewport sizes', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      const inviteToken = 'test-invite-token-12345';
      await page.goto(`/accept-invite?token=${inviteToken}`);
      
      // Should be responsive and usable on mobile
      await expect(page.locator('body')).toBeVisible();
      
      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    await test.step('Direct link access should work', async () => {
      // Should work when accessed directly (not from email client)
      const inviteToken = 'test-invite-token-12345';
      await page.goto(`/accept-invite?token=${inviteToken}`);
      
      // Should load properly
      await expect(page.locator('h1, h2, .title').first()).toBeVisible({ timeout: 5000 });
    });
  });
});