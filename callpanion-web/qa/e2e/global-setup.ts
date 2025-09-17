import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting CallPanion E2E Test Suite Global Setup');
  
  // Create browser instance for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Wait for application to be ready
    console.log('⏳ Waiting for application to be ready...');
    await page.goto(config.projects[0].use?.baseURL || 'http://localhost:5173');
    
    // Wait for main content to load
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Verify critical pages are accessible
    const pages = [
      '/', // Landing page
      '/family-login', // Auth page
    ];
    
    for (const pagePath of pages) {
      console.log(`✅ Checking page: ${pagePath}`);
      await page.goto(pagePath);
      await page.waitForSelector('body');
      
      // Check for any obvious errors
      const errorElements = await page.locator('[data-testid="error"], .error, [role="alert"]').count();
      if (errorElements > 0) {
        console.warn(`⚠️  Warning: Found ${errorElements} error elements on ${pagePath}`);
      }
    }
    
    console.log('✅ Application health check passed');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('🎯 Global setup completed successfully');
}

export default globalSetup;