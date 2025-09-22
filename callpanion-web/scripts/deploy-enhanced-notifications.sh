#!/bin/bash

# ===============================================
# ENHANCED IN-APP NOTIFICATION DEPLOYMENT SCRIPT
# ===============================================
# This script deploys the new notification queue system

set -e

echo "🚀 Deploying Enhanced In-App Call Notification System..."
echo "════════════════════════════════════════════════════════"

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: Please run this script from the callpanion-web directory"
    exit 1
fi

# Step 1: Deploy database migrations
echo "📊 Step 1: Deploying database migrations..."
supabase db push

# Step 2: Deploy enhanced scheduler function
echo "🔧 Step 2: Deploying enhanced scheduler function..."
supabase functions deploy schedulerInAppCalls

# Step 3: Test the new RPC functions
echo "🧪 Step 3: Testing new RPC functions..."

echo "   Testing rpc_find_schedules_to_queue..."
supabase sql --query "SELECT COUNT(*) as schedules_to_queue FROM rpc_find_schedules_to_queue();"

echo "   Testing rpc_find_ready_notifications..."
supabase sql --query "SELECT COUNT(*) as ready_notifications FROM rpc_find_ready_notifications();"

echo "   Testing cleanup function..."
supabase sql --query "SELECT cleanup_notification_queue() as cleaned_count;"

# Step 4: Check cron job status
echo "📅 Step 4: Checking cron job status..."
supabase sql --query "SELECT * FROM cron_job_status;"

# Step 5: Manual test trigger
echo "🔥 Step 5: Manual test trigger..."
echo "Triggering scheduler manually to test..."

# Get the function URL
PROJECT_REF=$(supabase status --output json | jq -r '.[] | select(.name == "API") | .status' | grep -o 'umjtepmdwfyfhdzbkyli')
ANON_KEY=$(supabase status --output json | jq -r '.[] | select(.name == "API") | .anon_key // empty')

if [ -n "$PROJECT_REF" ] && [ -n "$ANON_KEY" ]; then
    echo "   Project: $PROJECT_REF"
    echo "   Testing manual trigger..."

    curl -X POST "https://$PROJECT_REF.supabase.co/functions/v1/schedulerInAppCalls" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "Content-Type: application/json" \
      -d '{"trigger": "manual_test", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
      | jq '.'
else
    echo "⚠️  Could not determine project details for manual test"
fi

echo ""
echo "✅ Deployment completed successfully!"
echo "════════════════════════════════════════════════════════"
echo "📋 Next Steps:"
echo "   1. Verify cron jobs are running: SELECT * FROM cron_job_status;"
echo "   2. Check notification queue: SELECT * FROM notification_queue;"
echo "   3. Monitor logs in Supabase dashboard"
echo "   4. Test schedule creation in dashboard"
echo ""
echo "🎯 For schedule at 20:45:"
echo "   • 20:40 - Notification will be queued"
echo "   • 20:45 - Notification will be sent to device"
echo "   • System will retry up to 3 times if needed"
echo ""
echo "📊 Monitor with:"
echo "   SELECT * FROM cron_job_status;"
echo "   SELECT * FROM notification_queue WHERE status = 'queued';"
echo "   SELECT * FROM cron_heartbeat WHERE job_name = 'callpanion-in-app-calls';"
echo "════════════════════════════════════════════════════════"