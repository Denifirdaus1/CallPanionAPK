import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting CallPanion E2E Test Suite Global Teardown');
  
  try {
    // Generate test summary report
    const reportsDir = path.join(__dirname, '..', 'reports');
    const resultsFile = path.join(reportsDir, 'test-results.json');
    
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0,
        status: (results.stats?.failed || 0) === 0 ? 'PASS' : 'FAIL'
      };
      
      console.log('📊 Test Summary:');
      console.log(`   Total Tests: ${summary.totalTests}`);
      console.log(`   Passed: ${summary.passed}`);
      console.log(`   Failed: ${summary.failed}`);
      console.log(`   Skipped: ${summary.skipped}`);
      console.log(`   Duration: ${Math.round(summary.duration / 1000)}s`);
      console.log(`   Overall Status: ${summary.status}`);
      
      // Write summary to file
      const summaryFile = path.join(reportsDir, 'summary.json');
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
      
      // Generate markdown report
      const markdownReport = `# CallPanion E2E Test Report

## Summary
- **Timestamp**: ${summary.timestamp}
- **Total Tests**: ${summary.totalTests}
- **Passed**: ✅ ${summary.passed}
- **Failed**: ${summary.failed > 0 ? '❌' : '✅'} ${summary.failed}
- **Skipped**: ${summary.skipped}
- **Duration**: ${Math.round(summary.duration / 1000)}s
- **Overall Status**: ${summary.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}

${summary.failed > 0 ? `
## ⚠️ Action Required
${summary.failed} test(s) failed. Please review the detailed report for more information.
` : '## ✅ All Tests Passed'}

## Reports Generated
- \`playwright-report/index.html\` - Interactive HTML report
- \`test-results.json\` - Raw test results
- \`test-results.xml\` - JUnit format for CI/CD
- \`summary.json\` - Test summary data

## Next Steps
1. Review failed tests (if any) in the HTML report
2. Check screenshots and videos for failed tests
3. Run RLS verification if security tests failed
4. Update test data or fix application issues as needed
`;
      
      const reportFile = path.join(reportsDir, 'README.md');
      fs.writeFileSync(reportFile, markdownReport);
      
      console.log('📄 Test reports generated:');
      console.log(`   📊 HTML Report: ${path.join(reportsDir, 'playwright-report', 'index.html')}`);
      console.log(`   📋 Summary: ${summaryFile}`);
      console.log(`   📝 README: ${reportFile}`);
      
    } else {
      console.warn('⚠️  No test results file found');
    }
    
  } catch (error) {
    console.error('❌ Error during teardown:', error);
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;