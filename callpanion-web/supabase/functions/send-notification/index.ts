import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { Resend } from "npm:resend@2.0.0"

// Secure CORS with origin allowlist
const getAllowedOrigins = () => {
  const allowed = Deno.env.get('ALLOWED_ORIGINS') || 'https://umjtepmdwfyfhdzbkyli.supabase.co,https://callpanion.com';
  return allowed.split(',').map(origin => origin.trim());
};

const corsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

interface NotificationRequest {
  type: 'email' | 'sms' | 'push'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  data?: Record<string, any>
  household_id: string  // Required - determines recipients server-side
  relative_id?: string
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const smsApiKey = Deno.env.get('SMS_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = resendApiKey ? new Resend(resendApiKey) : null

    // Authenticate user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting per caller
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      _identifier: user.id,
      _endpoint: 'send-notification',
      _max_requests: 10,
      _window_minutes: 10
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const {
      type,
      title,
      message,
      priority,
      data,
      household_id,
      relative_id
    }: NotificationRequest = await req.json()

    if (!household_id || !title || !message) {
      throw new Error('Missing required fields: household_id, title, message')
    }

    // Verify caller is household admin OR org admin
    const { data: isHouseholdAdmin } = await supabase.rpc('app_is_household_admin', {
      _household_id: household_id
    });
    
    const { data: isOrgAdmin } = await supabase.rpc('has_admin_access_with_mfa', {
      user_id: user.id
    });

    if (!isHouseholdAdmin && !isOrgAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Must be household admin or org admin' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Get household members server-side (security)
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('user_id, profiles!inner(email, phone)')
      .eq('household_id', household_id);

    if (membersError || !members?.length) {
      throw new Error('No household members found or access denied')
    }

    // Build recipients based on notification type
    let recipients: string[] = [];
    switch (type) {
      case 'email':
        recipients = members.map(m => m.profiles.email).filter(Boolean);
        break;
      case 'sms':
        recipients = members.map(m => m.profiles.phone).filter(Boolean);
        break;
      case 'push':
        recipients = members.map(m => m.user_id);
        break;
      default:
        throw new Error(`Unsupported notification type: ${type}`)
    }

    console.log(`Sending ${type} notification to ${recipients.length} recipients: ${title}`)

    let successCount = 0
    let failureCount = 0
    const errors: string[] = []

    // Send notifications based on type
    for (const recipient of recipients) {
      try {
        switch (type) {
          case 'email':
            if (!resend) {
              throw new Error('Email service not configured')
            }
            
            await resend.emails.send({
              from: 'CallPanion <alerts@callpanion.com>',
              to: [recipient],
              subject: title,
              html: generateEmailHTML(title, message, priority, data),
            })
            break

          case 'sms':
            if (!smsApiKey) {
              throw new Error('SMS service not configured')
            }
            
            // Using Twilio as example - replace with your SMS provider
            await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`YOUR_ACCOUNT_SID:${smsApiKey}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                'From': '+1234567890', // Your Twilio number
                'To': recipient,
                'Body': `${title}: ${message}`
              }),
            })
            break

          case 'push':
            // Use existing push notification function
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_ids: [recipient],
                title,
                body: message,
                data: {
                  priority,
                  household_id,
                  relative_id,
                  ...data
                }
              }
            })
            break

          default:
            throw new Error(`Unsupported notification type: ${type}`)
        }

        successCount++
      } catch (error) {
        failureCount++
        errors.push(`${recipient}: ${error.message}`)
        console.error(`Failed to send ${type} to ${recipient}:`, error)
      }
    }

    // Log notification history
    const notificationHistory = recipients.map(recipient => ({
      user_id: recipient,
      title,
      body: message,
      data: data || {},
      status: 'sent',
      sent_at: new Date().toISOString(),
      delivery_method: type
    }))

    // For email/SMS, we need to map recipients back to user IDs
    if (type === 'email' || type === 'sms') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, phone')
        .in(type === 'email' ? 'email' : 'phone', recipients)

      if (users?.length) {
        const userNotifications = users.map(user => ({
          user_id: user.id,
          title,
          body: message,
          data: data || {},
          status: successCount > 0 ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
          error_message: failureCount > 0 ? errors.join(', ') : null
        }))

        await supabase
          .from('notification_history')
          .insert(userNotifications)
      }
    }

    // Create family notification if household_id provided
    if (household_id) {
      await supabase
        .from('family_notifications')
        .insert({
          household_id,
          relative_id,
          title,
          message,
          notification_type: 'alert',
          priority,
          sent_to_user_ids: recipients
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        errors: errors.length > 0 ? errors : undefined,
        method: type,
        household_id
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Notification service error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  }
})

// Sanitize HTML content to prevent injection
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function generateEmailHTML(title: string, message: string, priority: string, data?: Record<string, any>) {
  const priorityColor = {
    low: '#10b981',
    medium: '#f59e0b', 
    high: '#ef4444',
    critical: '#dc2626'
  }[priority] || '#6b7280'

  // Sanitize all user inputs
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safePriority = escapeHtml(priority);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${safeTitle}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">CallPanion Alert</h1>
        <div style="background: ${priorityColor}; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold; margin-top: 10px; display: inline-block;">
          ${safePriority.toUpperCase()} PRIORITY
        </div>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <h2 style="color: #333; margin-top: 0;">${safeTitle}</h2>
        <p style="font-size: 16px; margin-bottom: 20px;">${safeMessage}</p>
        
        ${data ? `
          <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid ${priorityColor};">
            <h3 style="margin-top: 0; color: #333;">Additional Details:</h3>
            ${Object.entries(data).map(([key, value]) => 
              `<p style="margin: 5px 0;"><strong>${escapeHtml(String(key))}:</strong> ${escapeHtml(String(value))}</p>`
            ).join('')}
          </div>
        ` : ''}
      </div>
      
      <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <p style="margin: 0; color: #666; font-size: 14px;">
          This alert was sent by CallPanion family monitoring system
        </p>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">
          Sent at ${new Date().toLocaleString()}
        </p>
      </div>
    </body>
    </html>
  `
}