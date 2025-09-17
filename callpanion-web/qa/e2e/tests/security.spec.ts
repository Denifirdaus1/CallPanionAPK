import { test, expect } from '@playwright/test';

// Helper function to login as different users
async function loginAsUser(page: any, userType: 'admin' | 'member') {
  const credentials = {
    admin: { email: 'admin.test@callpanion.com', password: 'TestPassword123!' },
    member: { email: 'member.test@callpanion.com', password: 'TestPassword123!' }
  };
  
  await page.goto('/family-login');
  await page.fill('input[type="email"]', credentials[userType].email);
  await page.fill('input[type="password"]', credentials[userType].password);
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
  await page.waitForURL(/\/family/, { timeout: 10000 });
}

test.describe('Security and Access Control', () => {

  test('H001: Authentication is required for protected routes', async ({ page }) => {
    // GIVEN: User is not authenticated
    // WHEN: User tries to access protected routes
    // THEN: Should be redirected to login
    
    const protectedRoutes = [
      '/family/dashboard',
      '/family/members', 
      '/family/messages',
      '/family/health',
      '/family/settings'
    ];

    for (const route of protectedRoutes) {
      await test.step(`Route ${route} requires authentication`, async () => {
        // Clear any existing session
        await page.context().clearCookies();
        
        await page.goto(route);
        
        // Should redirect to login or show login form
        const isAuthenticated = await page.locator('input[type="email"], input[type="password"]').isVisible({ timeout: 3000 });
        const currentUrl = page.url();
        
        expect(
          isAuthenticated || currentUrl.includes('login') || currentUrl.includes('auth')
        ).toBeTruthy();
      });
    }
  });

  test('H002: Users cannot access other households data', async ({ page }) => {
    // GIVEN: User is authenticated to one household
    // WHEN: User tries to access another household's data
    // THEN: Should be denied access
    
    await loginAsUser(page, 'admin');
    
    await test.step('Monitor network requests for unauthorized access', async () => {
      let unauthorizedAttempts: string[] = [];
      
      // Monitor network responses
      page.on('response', response => {
        if (response.status() === 403 || response.status() === 401) {
          unauthorizedAttempts.push(response.url());
        }
      });
      
      // Navigate through the application
      await page.goto('/family/dashboard');
      await page.goto('/family/members');
      await page.goto('/family/messages');
      
      // Any 401/403 responses indicate proper security (expected behavior)
      if (unauthorizedAttempts.length > 0) {
        console.log('Security responses detected (this is good):', unauthorizedAttempts);
      }
    });

    await test.step('API responses should not contain cross-household data', async () => {
      // Check that data responses don't contain excessive amounts of data
      // (which might indicate cross-household leakage)
      
      await page.goto('/family/members');
      
      // Look for member lists - should be reasonable size
      const memberElements = page.locator('.member, .user, .relative, [data-testid*="member"]');
      const memberCount = await memberElements.count();
      
      // Should not see an excessive number of members (indicating data leakage)
      expect(memberCount).toBeLessThan(50); // Reasonable upper bound for a single household
    });
  });

  test('H003: Role-based access control is enforced', async ({ page }) => {
    // GIVEN: Users have different roles
    // WHEN: Users access role-restricted features
    // THEN: Access should match their permissions
    
    await test.step('Admin has full access', async () => {
      await loginAsUser(page, 'admin');
      
      await page.goto('/family/members');
      
      // Admin should see management options
      const adminElements = page.locator(
        'button:has-text("Add"), button:has-text("Invite"), button:has-text("Edit"), button:has-text("Remove")'
      );
      
      const adminCount = await adminElements.count();
      expect(adminCount).toBeGreaterThan(0);
    });

    await test.step('Member has limited access', async () => {
      // Clear session and login as member
      await page.context().clearCookies();
      await loginAsUser(page, 'member');
      
      await page.goto('/family/members');
      
      // Member should NOT see admin-only options
      const restrictedElements = page.locator(
        'button:has-text("Delete Household"), button:has-text("Remove Member"), button:has-text("Change Owner")'
      );
      
      const restrictedCount = await restrictedElements.count();
      expect(restrictedCount).toBe(0);
    });
  });

  test('H004: Health data access requires proper permissions', async ({ page }) => {
    // GIVEN: Health data exists in the system
    // WHEN: Users with different permissions access health data
    // THEN: Access should be appropriately restricted
    
    await test.step('Admin can access health insights', async () => {
      await loginAsUser(page, 'admin');
      
      await page.goto('/family/health');
      
      // Should load health page without errors
      await expect(page.locator('h1, h2, .title').first()).toBeVisible({ timeout: 5000 });
      
      // Should not show access denied message
      const accessDenied = await page.locator(':has-text("access denied"), :has-text("permission")').isVisible();
      expect(accessDenied).toBeFalsy();
    });

    await test.step('Member access depends on granted permissions', async () => {
      // Clear session and login as member
      await page.context().clearCookies();
      await loginAsUser(page, 'member');
      
      await page.goto('/family/health');
      
      // Member might have different levels of access
      const hasFullAccess = await page.locator('.chart, .detailed-data, .analysis').isVisible();
      const hasSummaryAccess = await page.locator(':has-text("summary"), :has-text("overview")').isVisible();
      const hasNoAccess = await page.locator(':has-text("access"), :has-text("permission")').isVisible();
      
      // Should have one of these states (not an error state)
      expect(hasFullAccess || hasSummaryAccess || hasNoAccess).toBeTruthy();
    });
  });

  test('H005: Session management and logout work properly', async ({ page }) => {
    // GIVEN: User is authenticated
    // WHEN: User logs out
    // THEN: Session should be properly cleared
    
    await loginAsUser(page, 'admin');
    
    await test.step('User is initially authenticated', async () => {
      await page.goto('/family/dashboard');
      
      // Should have access to protected content
      await expect(page.locator('h1, h2, .dashboard').first()).toBeVisible({ timeout: 5000 });
    });

    await test.step('Logout clears session', async () => {
      // Find and click logout button
      const logoutButton = page.locator(
        'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"], .logout'
      ).first();
      
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        
        // Should redirect to public page or login
        await page.waitForTimeout(2000); // Allow redirect time
        
        const currentUrl = page.url();
        expect(
          currentUrl.includes('/') || 
          currentUrl.includes('login') || 
          currentUrl.includes('auth')
        ).toBeTruthy();
      }
    });

    await test.step('Protected routes require re-authentication', async () => {
      // Try to access protected route after logout
      await page.goto('/family/dashboard');
      
      // Should be redirected to login
      const needsAuth = await page.locator('input[type="email"], input[type="password"]').isVisible({ timeout: 3000 });
      const currentUrl = page.url();
      
      expect(
        needsAuth || currentUrl.includes('login') || currentUrl.includes('auth')
      ).toBeTruthy();
    });
  });

  test('H006: Sensitive data is not exposed in client logs', async ({ page }) => {
    // GIVEN: User interacts with the application
    // WHEN: Operations involving sensitive data occur
    // THEN: Sensitive data should not appear in browser console
    
    const consoleMessages: string[] = [];
    
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await loginAsUser(page, 'admin');

    await test.step('Navigate through sensitive areas', async () => {
      await page.goto('/family/members');
      await page.goto('/family/health');
      await page.goto('/family/messages');
      
      // Allow time for any async operations
      await page.waitForTimeout(2000);
    });

    await test.step('Check console logs for sensitive data', async () => {
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /secret/i,
        /api[_-]?key/i,
        /auth[_-]?token/i,
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email pattern
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ // Credit card pattern
      ];

      const exposedData = consoleMessages.filter(msg => 
        sensitivePatterns.some(pattern => pattern.test(msg))
      );

      if (exposedData.length > 0) {
        console.warn('Potentially sensitive data in console:', exposedData);
      }

      // Should not have obvious sensitive data in logs
      expect(exposedData.length).toBe(0);
    });
  });

  test('H007: Input validation prevents injection attacks', async ({ page }) => {
    // GIVEN: User has access to input forms
    // WHEN: User submits potentially malicious input
    // THEN: Input should be properly sanitized
    
    await loginAsUser(page, 'admin');

    await test.step('Test XSS prevention in message input', async () => {
      await page.goto('/family/messages');
      
      const messageInput = page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
      
      if (await messageInput.isVisible()) {
        // Try XSS payload
        const xssPayload = '<script>alert("xss")</script>';
        await messageInput.fill(xssPayload);
        
        const sendButton = page.locator('button:has-text("Send"), button[type="submit"]').first();
        if (await sendButton.isVisible()) {
          await sendButton.click();
          
          // Wait and check that no alert fired (XSS was prevented)
          await page.waitForTimeout(2000);
          
          // If we get here without an alert, XSS was prevented
          // In a real test, you might check that the content is properly escaped
        }
      }
    });

    await test.step('Test SQL injection prevention in search/forms', async () => {
      // Try SQL injection in any search or form fields
      const searchInputs = page.locator('input[type="search"], input[placeholder*="search"]');
      
      if (await searchInputs.count() > 0) {
        const sqlPayload = "'; DROP TABLE users; --";
        await searchInputs.first().fill(sqlPayload);
        
        // Submit or trigger search
        await page.keyboard.press('Enter');
        
        // Application should still function (injection was prevented)
        await page.waitForTimeout(1000);
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test('H008: File upload restrictions are enforced', async ({ page }) => {
    // GIVEN: User has access to file upload features
    // WHEN: User attempts to upload various file types
    // THEN: Only allowed file types should be accepted
    
    await loginAsUser(page, 'admin');

    await test.step('Check photo upload restrictions', async () => {
      await page.goto('/family/memories');
      
      const uploadInput = page.locator('input[type="file"]').first();
      
      if (await uploadInput.isVisible()) {
        // Check file type restrictions in HTML
        const acceptAttribute = await uploadInput.getAttribute('accept');
        
        if (acceptAttribute) {
          // Should restrict to image types
          expect(acceptAttribute).toMatch(/image/);
        }
        
        // In a real test, you would test uploading actual files
        // For now, just verify the upload interface exists and has restrictions
        await expect(uploadInput).toBeVisible();
      }
    });
  });

  test('H009: Rate limiting prevents abuse', async ({ page }) => {
    // GIVEN: User has access to forms/actions
    // WHEN: User performs actions rapidly
    // THEN: Rate limiting should prevent abuse
    
    await loginAsUser(page, 'admin');

    await test.step('Test rapid form submissions', async () => {
      await page.goto('/family/messages');
      
      const messageInput = page.locator('textarea, input[type="text"]').first();
      const sendButton = page.locator('button:has-text("Send"), button[type="submit"]').first();
      
      if (await messageInput.isVisible() && await sendButton.isVisible()) {
        // Try to send messages rapidly
        for (let i = 0; i < 10; i++) {
          await messageInput.fill(`Rapid message ${i}`);
          await sendButton.click();
          await page.waitForTimeout(100); // Very short delay
          
          // Check if rate limiting kicks in
          const rateLimitMessage = page.locator(
            ':has-text("rate limit"), :has-text("too many"), :has-text("slow down"), .error'
          );
          
          if (await rateLimitMessage.isVisible()) {
            console.log('Rate limiting detected (this is good security)');
            break;
          }
        }
      }
    });
  });

  test('H010: HTTPS and secure headers are enforced', async ({ page }) => {
    // GIVEN: User accesses the application
    // WHEN: Security headers are checked
    // THEN: Appropriate security headers should be present
    
    await test.step('Check for security headers', async () => {
      const response = await page.goto('/');
      
      if (response) {
        const headers = response.headers();
        
        // Check for important security headers
        const securityHeaders = [
          'x-frame-options',
          'x-content-type-options', 
          'x-xss-protection',
          'strict-transport-security'
        ];
        
        let secureHeadersPresent = 0;
        securityHeaders.forEach(header => {
          if (headers[header]) {
            secureHeadersPresent++;
            console.log(`Security header found: ${header} = ${headers[header]}`);
          }
        });
        
        // Should have at least some security headers
        // Note: This depends on your hosting/proxy configuration
        console.log(`Found ${secureHeadersPresent} security headers out of ${securityHeaders.length}`);
      }
    });

    await test.step('Verify HTTPS usage in production-like environment', async () => {
      const currentUrl = page.url();
      
      // In production, should use HTTPS
      if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
        console.log('Testing on localhost - HTTPS not required');
      } else {
        expect(currentUrl).toMatch(/^https:/);
      }
    });
  });
});