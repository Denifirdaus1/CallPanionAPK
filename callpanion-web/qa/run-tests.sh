#!/bin/bash

# CallPanion QA Test Execution Script
# This script runs the complete test suite and generates reports

set -e  # Exit on any error

echo "🚀 Starting CallPanion QA Test Suite"
echo "======================================"

# Configuration
PROJECT_ROOT="$(dirname "$(dirname "$(realpath "$0")")")"
QA_DIR="$PROJECT_ROOT/qa"
E2E_DIR="$QA_DIR/e2e"
REPORTS_DIR="$QA_DIR/reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Step 1: Check prerequisites
log_info "Checking prerequisites..."

if ! command -v npm &> /dev/null; then
    log_error "npm is required but not installed"
    exit 1
fi

if ! command -v node &> /dev/null; then
    log_error "Node.js is required but not installed"
    exit 1
fi

log_success "Prerequisites check passed"

# Step 2: Install dependencies
log_info "Installing E2E test dependencies..."
cd "$E2E_DIR"

if [ ! -d "node_modules" ]; then
    npm install
    log_success "Dependencies installed"
else
    log_info "Dependencies already installed"
fi

# Step 3: Install Playwright browsers
log_info "Installing Playwright browsers..."
npx playwright install
log_success "Playwright browsers installed"

# Step 4: Verify application is running
log_info "Checking if application is running..."

if curl -s -f http://localhost:5173 > /dev/null; then
    log_success "Application is running on http://localhost:5173"
else
    log_warning "Application not running on localhost:5173"
    log_info "Starting development server..."
    
    cd "$PROJECT_ROOT"
    if [ -f "package.json" ]; then
        npm run dev &
        DEV_PID=$!
        
        # Wait for server to start
        log_info "Waiting for development server to start..."
        for i in {1..30}; do
            if curl -s -f http://localhost:5173 > /dev/null; then
                log_success "Development server started"
                break
            fi
            sleep 2
        done
        
        if ! curl -s -f http://localhost:5173 > /dev/null; then
            log_error "Failed to start development server"
            kill $DEV_PID 2>/dev/null || true
            exit 1
        fi
    else
        log_error "No package.json found in project root"
        exit 1
    fi
fi

# Step 5: Run RLS verification tests (optional)
if [ -f "$QA_DIR/rls/rls_checks.sql" ]; then
    log_info "RLS verification script found but requires manual execution"
    log_warning "Please run RLS checks manually via Supabase dashboard"
    log_info "File: $QA_DIR/rls/rls_checks.sql"
fi

# Step 6: Run E2E tests
log_info "Running E2E test suite..."
cd "$E2E_DIR"

TEST_EXIT_CODE=0

# Run tests with proper reporting
if npx playwright test --reporter=html,json,junit; then
    log_success "E2E tests completed successfully"
else
    TEST_EXIT_CODE=$?
    log_warning "Some E2E tests failed (exit code: $TEST_EXIT_CODE)"
fi

# Step 7: Generate consolidated report
log_info "Generating test reports..."

if [ -f "../reports/test-results.json" ]; then
    # Extract summary from JSON
    TOTAL_TESTS=$(jq -r '.stats.total // 0' "../reports/test-results.json" 2>/dev/null || echo "0")
    PASSED_TESTS=$(jq -r '.stats.passed // 0' "../reports/test-results.json" 2>/dev/null || echo "0")
    FAILED_TESTS=$(jq -r '.stats.failed // 0' "../reports/test-results.json" 2>/dev/null || echo "0")
    
    echo "📊 Test Summary:"
    echo "   Total: $TOTAL_TESTS"
    echo "   Passed: $PASSED_TESTS"
    echo "   Failed: $FAILED_TESTS"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "All tests passed! ✨"
    else
        log_warning "$FAILED_TESTS test(s) failed"
    fi
else
    log_warning "Test results JSON not found"
fi

# Step 8: Open reports
if command -v open &> /dev/null; then
    OPEN_CMD="open"
elif command -v xdg-open &> /dev/null; then
    OPEN_CMD="xdg-open"
else
    OPEN_CMD=""
fi

if [ -n "$OPEN_CMD" ] && [ -f "../reports/playwright-report/index.html" ]; then
    log_info "Opening test report in browser..."
    $OPEN_CMD "../reports/playwright-report/index.html"
fi

# Step 9: Cleanup
if [ -n "${DEV_PID:-}" ]; then
    log_info "Stopping development server..."
    kill $DEV_PID 2>/dev/null || true
    log_success "Development server stopped"
fi

# Step 10: Final summary
echo ""
echo "🎯 QA Test Suite Complete"
echo "========================="
echo "📁 Reports available in: $REPORTS_DIR"
echo "🌐 HTML Report: $REPORTS_DIR/playwright-report/index.html"
echo "📄 JSON Results: $REPORTS_DIR/test-results.json"
echo "📋 JUnit Report: $REPORTS_DIR/test-results.xml"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    log_success "QA Test Suite: PASSED ✨"
    echo ""
    echo "🎉 All tests passed! Your CallPanion application is working correctly."
    echo ""
    echo "Next steps:"
    echo "1. Review the detailed HTML report for test coverage"
    echo "2. Run RLS verification manually if needed"
    echo "3. Deploy with confidence!"
else
    log_error "QA Test Suite: FAILED"
    echo ""
    echo "🔍 Test failures detected. Please review:"
    echo "1. Check the HTML report for detailed failure information"
    echo "2. Look at screenshots and videos for failed tests"
    echo "3. Fix issues and re-run tests"
    echo ""
    echo "Common issues:"
    echo "- Authentication problems (check test user accounts)"
    echo "- RLS policy restrictions (verify database permissions)" 
    echo "- UI element selectors (check for recent UI changes)"
    echo "- Network timeouts (check application performance)"
fi

exit $TEST_EXIT_CODE