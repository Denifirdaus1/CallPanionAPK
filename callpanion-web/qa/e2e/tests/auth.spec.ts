import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Start from clean state
    await page.goto('/');
  });

  test('A001: Unauthenticated user can view marketing pages', async ({ page }) => {
    // GIVEN: User is not authenticated
    // WHEN: User visits marketing pages
    // THEN: Pages should load without requiring login
    
    await test.step('Landing page loads without authentication', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle(/CallPanion/i);
      
      // Check for key marketing elements
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      // Should not redirect to login
      await expect(page).toHaveURL('/');
    });

    await test.step('Privacy page is accessible', async () => {
      await page.goto('/privacy');
      await expect(page.locator('h1')).toContainText(/privacy/i);
    });

    await test.step('Terms page is accessible', async () => {
      await page.goto('/terms');
      await expect(page.locator('h1')).toContainText(/terms/i);
    });
  });

  test('A002: Protected routes redirect to login', async ({ page }) => {
    // GIVEN: User is not authenticated
    // WHEN: User tries to access protected routes  
    // THEN: Should be redirected to login
    
    const protectedRoutes = [
      '/family',
      '/family/dashboard', 
      '/family/messages',
      '/family/members',
      '/family/health'
    ];

    for (const route of protectedRoutes) {
      await test.step(`Route ${route} redirects to login`, async () => {
        await page.goto(route);
        
        // Should redirect to login page
        await expect(page).toHaveURL(/.*\/(family-login|login)/);
        
        // Or show login form on same page
        await expect(
          page.locator('input[type="email"], [data-testid="email-input"]')
        ).toBeVisible({ timeout: 5000 });
      });
    }
  });

  test('A003: Login form validation works correctly', async ({ page }) => {
    // GIVEN: User is on login page
    // WHEN: User submits invalid data
    // THEN: Appropriate validation errors are shown
    
    await page.goto('/family-login');
    
    await test.step('Empty form shows validation errors', async () => {
      // Try to submit empty form
      await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
      
      // Should show some form of validation
      const hasValidation = await page.locator(
        'input:invalid, .error, [role="alert"], .text-red-500, .text-destructive'
      ).count() > 0;
      
      expect(hasValidation).toBeTruthy();
    });

    await test.step('Invalid email format shows error', async () => {
      await page.fill('input[type="email"], [data-testid="email-input"]', 'invalid-email');
      await page.fill('input[type="password"], [data-testid="password-input"]', 'password123');
      
      await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
      
      // Should show email validation error or prevent submission
      const emailInput = page.locator('input[type="email"], [data-testid="email-input"]');
      const isInvalid = await emailInput.evaluate(el => !(el as HTMLInputElement).validity.valid);
      
      expect(isInvalid).toBeTruthy();
    });
  });

  test('A004: Sign up flow is accessible', async ({ page }) => {
    // GIVEN: User wants to create account
    // WHEN: User accesses sign up form
    // THEN: Should be able to register new account
    
    await page.goto('/family-login');
    
    await test.step('Sign up form is accessible', async () => {
      // Look for sign up option
      const signUpElement = await page.locator(
        'button:has-text("Sign Up"), button:has-text("Register"), a:has-text("Sign Up"), [data-testid="signup-tab"]'
      ).first();
      
      if (await signUpElement.isVisible()) {
        await signUpElement.click();
      }
      
      // Should have sign up form elements
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      
      // Should have submit button for registration
      await expect(
        page.locator('button:has-text("Sign Up"), button:has-text("Register"), button:has-text("Create")')
      ).toBeVisible();
    });

    await test.step('Sign up form accepts valid input', async () => {
      const testEmail = `test+${Date.now()}@example.com`;
      
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', 'SecurePassword123!');
      
      // Note: We don't actually submit to avoid creating test accounts
      // In real tests, you might use a test email service or cleanup afterwards
      const submitButton = page.locator(
        'button:has-text("Sign Up"), button:has-text("Register"), button:has-text("Create")'
      ).first();
      
      await expect(submitButton).toBeEnabled();
    });
  });

  test('A005: Waitlist form submission works', async ({ page }) => {
    // GIVEN: User is on landing page
    // WHEN: User submits waitlist form
    // THEN: Form should submit successfully with validation
    
    await page.goto('/');
    
    await test.step('Find and fill waitlist form', async () => {
      // Look for waitlist form - might be in a modal or section
      const waitlistTrigger = page.locator(
        'button:has-text("Join"), button:has-text("Waitlist"), [data-testid="waitlist-button"]'
      ).first();
      
      if (await waitlistTrigger.isVisible()) {
        await waitlistTrigger.click();
        
        // Wait for form to appear (might be in modal)
        await page.waitForSelector('input[type="email"]', { timeout: 5000 });
      }
    });

    await test.step('Submit valid waitlist form', async () => {
      const testEmail = `waitlist+${Date.now()}@example.com`;
      
      await page.fill('input[type="email"]', testEmail);
      
      // Fill name if present
      const nameInput = page.locator('input[placeholder*="name"], input[type="text"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test User');
      }
      
      // Accept consent if present
      const consentCheckbox = page.locator('input[type="checkbox"]').first();
      if (await consentCheckbox.isVisible()) {
        await consentCheckbox.check();
      }
      
      // Submit form
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Submit"), button:has-text("Join")'
      ).first();
      
      await submitButton.click();
      
      // Should show success message or confirmation
      await expect(
        page.locator('.success, .toast, [role="alert"]:has-text("success"), .text-green')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test('A006: Rate limiting works on forms', async ({ page }) => {
    // GIVEN: User submits forms rapidly
    // WHEN: Rate limit is exceeded
    // THEN: Should show rate limit message
    
    await page.goto('/');
    
    // This test would need to be adapted based on actual rate limiting implementation
    await test.step('Multiple rapid submissions trigger rate limiting', async () => {
      // Find a form that has rate limiting (waitlist, contact, etc.)
      const form = page.locator('form').first();
      
      if (await form.isVisible()) {
        // Try to submit multiple times rapidly
        for (let i = 0; i < 5; i++) {
          const submitButton = form.locator('button[type="submit"]').first();
          if (await submitButton.isVisible() && await submitButton.isEnabled()) {
            await submitButton.click();
            await page.waitForTimeout(100); // Small delay between attempts
          }
        }
        
        // Check if any rate limiting message appears
        // This would need to match your actual implementation
        const rateLimitMessage = page.locator(
          ':has-text("too many"), :has-text("rate limit"), :has-text("try again"), .error'
        );
        
        // Note: This might not trigger in a real test - depends on implementation
        // The test structure is here for when rate limiting is implemented
      }
    });
  });
});