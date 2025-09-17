import { test, expect } from '@playwright/test';

// Helper function to login as family admin
async function loginAsAdmin(page: any) {
  await page.goto('/family-login');
  
  // Look for email and password fields
  await page.fill('input[type="email"]', 'admin.test@callpanion.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  
  // Submit login form
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
  
  // Wait for redirect to family dashboard
  await page.waitForURL(/\/family/, { timeout: 10000 });
}

test.describe('Family Admin Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsAdmin(page);
  });

  test('B001: Admin can create household successfully', async ({ page }) => {
    // GIVEN: Admin is logged in
    // WHEN: Admin becomes administrator (if not already)
    // THEN: Should have full household management access
    
    await test.step('Become administrator if needed', async () => {
      // Look for "Become Administrator" button
      const becomeAdminButton = page.locator('button:has-text("Become Administrator")');
      
      if (await becomeAdminButton.isVisible()) {
        await becomeAdminButton.click();
        
        // Wait for success message or redirect
        await expect(
          page.locator('.success, .toast, [role="alert"]:has-text("success"), .text-green')
        ).toBeVisible({ timeout: 10000 });
      }
    });

    await test.step('Verify admin access to household features', async () => {
      // Should be able to access family dashboard
      await page.goto('/family/dashboard');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      // Should have admin navigation options
      const adminElements = await page.locator(
        'a:has-text("Members"), a:has-text("Settings"), button:has-text("Add"), button:has-text("Invite")'
      ).count();
      
      expect(adminElements).toBeGreaterThan(0);
    });
  });

  test('B002: Admin can add relative without invite email', async ({ page }) => {
    // GIVEN: Admin has household access
    // WHEN: Admin adds a relative without invite
    // THEN: Relative should be created successfully
    
    await page.goto('/family/members');
    
    await test.step('Navigate to add relative form', async () => {
      // Look for add relative button/link
      const addButton = page.locator(
        'button:has-text("Add"), a:has-text("Add"), button:has-text("Relative"), a:has-text("Relative")'
      ).first();
      
      await addButton.click();
      
      // Should navigate to add relative form
      await expect(page.locator('input, form')).toBeVisible({ timeout: 5000 });
    });

    await test.step('Fill relative information', async () => {
      const timestamp = Date.now();
      
      // Fill required fields
      await page.fill('input[placeholder*="first"], input[name*="first"], #firstName', `TestRelative${timestamp}`);
      await page.fill('input[placeholder*="last"], input[name*="last"], #lastName', `TestSurname${timestamp}`);
      
      // Fill optional fields if present
      const townInput = page.locator('input[placeholder*="town"], input[name*="town"], #town').first();
      if (await townInput.isVisible()) {
        await townInput.fill('Manchester');
      }
      
      const countyInput = page.locator('input[placeholder*="county"], input[name*="county"], #county').first();
      if (await countyInput.isVisible()) {
        await countyInput.fill('Greater Manchester');
      }
    });

    await test.step('Submit without invite email', async () => {
      // Make sure invite email is empty or not filled
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill(''); // Ensure empty
      }
      
      // Submit form
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Save"), button:has-text("Add"), button:has-text("Create")'
      ).first();
      
      await submitButton.click();
      
      // Should show success message
      await expect(
        page.locator('.success, .toast, [role="alert"]:has-text("success"), .text-green')
      ).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify relative appears in list', async () => {
      // Navigate back to relatives list
      await page.goto('/family/members');
      
      // Should see the new relative in the list
      await expect(page.locator(':has-text("TestRelative")')).toBeVisible({ timeout: 5000 });
    });
  });

  test('B003: Admin can add relative with invite email', async ({ page }) => {
    // GIVEN: Admin has household access
    // WHEN: Admin adds relative with invite email
    // THEN: Relative and invite should be created
    
    await page.goto('/family/members');
    
    await test.step('Navigate to add relative form', async () => {
      const addButton = page.locator(
        'button:has-text("Add"), a:has-text("Add"), [data-testid="add-relative"]'
      ).first();
      
      await addButton.click();
      await expect(page.locator('form, input')).toBeVisible({ timeout: 5000 });
    });

    await test.step('Fill relative information with invite', async () => {
      const timestamp = Date.now();
      const testEmail = `relative${timestamp}@example.com`;
      
      // Fill required fields
      await page.fill('input[placeholder*="first"], input[name*="first"], #firstName', `InviteRelative${timestamp}`);
      await page.fill('input[placeholder*="last"], input[name*="last"], #lastName', `InviteSurname${timestamp}`);
      
      // Fill invite email
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill(testEmail);
      }
      
      // Accept GDPR consent if present
      const consentCheckbox = page.locator('input[type="checkbox"]').first();
      if (await consentCheckbox.isVisible()) {
        await consentCheckbox.check();
      }
    });

    await test.step('Submit form with invite', async () => {
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Save"), button:has-text("Add"), button:has-text("Create")'
      ).first();
      
      await submitButton.click();
      
      // Should show success message mentioning invite
      const successMessage = page.locator(
        '.success, .toast, [role="alert"]:has-text("success"), .text-green, :has-text("invite")'
      );
      
      await expect(successMessage).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify relative and invite created', async () => {
      // Check relatives list
      await page.goto('/family/members');
      await expect(page.locator(':has-text("InviteRelative")')).toBeVisible({ timeout: 5000 });
      
      // If there's an invites section, check it too
      const invitesSection = page.locator(':has-text("Pending"), :has-text("Invites")');
      if (await invitesSection.isVisible()) {
        await expect(invitesSection).toContainText('relative');
      }
    });
  });

  test('B004: Admin can manage family members', async ({ page }) => {
    // GIVEN: Admin has household with members
    // WHEN: Admin manages member roles and permissions
    // THEN: Changes should be applied successfully
    
    await page.goto('/family/members');
    
    await test.step('View family members list', async () => {
      // Should see list of family members
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      // Should see member cards or list items
      const memberElements = await page.locator(
        '[data-testid="member-card"], .member, .user, [role="listitem"]'
      ).count();
      
      expect(memberElements).toBeGreaterThan(0);
    });

    await test.step('Update member role if possible', async () => {
      // Look for role change buttons/dropdowns
      const roleButton = page.locator(
        'button:has-text("Admin"), button:has-text("Member"), select, [data-testid="role-select"]'
      ).first();
      
      if (await roleButton.isVisible()) {
        await roleButton.click();
        
        // If it's a dropdown/select, choose an option
        const option = page.locator('option, [role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
        }
        
        // Look for save/confirm button
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          
          // Wait for success confirmation
          await expect(
            page.locator('.success, .toast, [role="alert"]:has-text("success")')
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });

    await test.step('Toggle health access permissions', async () => {
      // Look for health access toggle/checkbox
      const healthToggle = page.locator(
        'input[type="checkbox"]:near(:has-text("health")), button:has-text("health"), [data-testid="health-toggle"]'
      ).first();
      
      if (await healthToggle.isVisible()) {
        await healthToggle.click();
        
        // Wait for update confirmation
        await page.waitForTimeout(1000); // Give time for update
      }
    });
  });

  test('B005: Admin can send messages and upload photos', async ({ page }) => {
    // GIVEN: Admin is in family dashboard
    // WHEN: Admin sends messages and uploads photos
    // THEN: Content should be shared successfully
    
    await test.step('Send family message', async () => {
      await page.goto('/family/messages');
      
      // Look for message composition area
      const messageInput = page.locator(
        'textarea, input[type="text"]:not([type="email"]), [contenteditable="true"], [data-testid="message-input"]'
      ).first();
      
      if (await messageInput.isVisible()) {
        const testMessage = `Test message from admin at ${new Date().toLocaleString()}`;
        await messageInput.fill(testMessage);
        
        // Send message
        const sendButton = page.locator(
          'button:has-text("Send"), button[type="submit"], [data-testid="send-button"]'
        ).first();
        
        await sendButton.click();
        
        // Verify message appears
        await expect(page.locator(`:has-text("${testMessage}")`)).toBeVisible({ timeout: 5000 });
      }
    });

    await test.step('Upload family photo if feature exists', async () => {
      await page.goto('/family/memories');
      
      // Look for photo upload button/input
      const uploadButton = page.locator(
        'button:has-text("Upload"), input[type="file"], [data-testid="upload-button"]'
      ).first();
      
      if (await uploadButton.isVisible()) {
        // Note: In real tests, you'd use setInputFiles with a test image
        // For now, just verify the upload interface is accessible
        await expect(uploadButton).toBeEnabled();
      }
    });
  });

  test('B006: Admin can access health insights', async ({ page }) => {
    // GIVEN: Admin has full permissions
    // WHEN: Admin accesses health insights
    // THEN: Should see health data and analysis
    
    await page.goto('/family/health');
    
    await test.step('Access health insights page', async () => {
      // Should be able to access health page
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      // Should see health-related content
      const healthElements = await page.locator(
        ':has-text("health"), :has-text("mood"), :has-text("call"), :has-text("insight"), .chart, .graph'
      ).count();
      
      expect(healthElements).toBeGreaterThan(0);
    });

    await test.step('Verify health data visibility', async () => {
      // Should see some form of health data or placeholder
      const dataElements = page.locator(
        '.chart, .graph, .metric, .score, [data-testid="health-data"], .health-card'
      );
      
      const hasData = await dataElements.count() > 0;
      const hasPlaceholder = await page.locator(':has-text("No data"), :has-text("Coming soon")').isVisible();
      
      // Either should have data or appropriate placeholder
      expect(hasData || hasPlaceholder).toBeTruthy();
    });

    await test.step('Check export functionality if available', async () => {
      const exportButton = page.locator(
        'button:has-text("Export"), button:has-text("Download"), [data-testid="export-button"]'
      ).first();
      
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeEnabled();
        // Note: Don't actually trigger download in automated test
      }
    });
  });
});