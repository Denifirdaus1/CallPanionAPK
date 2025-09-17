import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serviceClient } from '../_shared/client.ts';

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  const allowlist = getAllowedOrigins();
  if (!origin) return false;
  try {
    const o = new URL(origin);
    return allowlist.includes(o.origin);
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  const allowed = isOriginAllowed(origin);
  const allowOrigin = allowed && origin ? origin : 'https://umjtepmdwfyfhdzbkyli.supabase.co';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

interface AlertRequest {
  type: 'missed_calls' | 'health_flag' | 'urgent_flag' | 'mood_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  user_id: string;
  user_name: string;
  recipient_contacts?: string[];
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  // Origin allowlist check
  if (!isOriginAllowed(origin)) {
    console.error('Blocked request from unauthorized origin:', origin);
    return new Response('Forbidden origin', { status: 403, headers: corsHeaders(origin) });
  }

  try {
    console.log('Family alert function triggered');
    
    const supabase = serviceClient();
    
    // Get and validate JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting check
    const rateLimitKey = `sendFamilyAlert:${ipAddress}`;
    const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      _identifier: rateLimitKey,
      _endpoint: 'sendFamilyAlert',
      _max_requests: 5,
      _window_minutes: 10
    });
    
    if (rateLimitError || !rateLimitCheck) {
      console.error('Rate limit exceeded for:', ipAddress);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const alertData: AlertRequest = await req.json();
    
    console.log('Alert data:', alertData);

    // Verify authorization - check if user has access to this relative
    const { data: authCheck, error: authCheckError } = await supabase
      .from('relatives')
      .select('household_id')
      .eq('id', alertData.user_id)
      .single();
    
    if (authCheckError || !authCheck) {
      console.error('Relative not found:', authCheckError);
      return new Response(JSON.stringify({ error: 'Relative not found' }), {
        status: 404,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Check if authenticated user has access to this household
    const { data: memberCheck, error: memberError } = await supabase.rpc('app_is_household_member', {
      _household_id: authCheck.household_id
    });
    
    const { data: adminCheck, error: adminError } = await supabase.rpc('has_admin_access_with_mfa', {
      _uid: user.id
    });
    
    if (!memberCheck && !adminCheck) {
      console.error('Unauthorized access to household:', user.id, authCheck.household_id);
      await supabase.rpc('log_security_event', {
        event_type_param: 'unauthorized_alert_access',
        details_param: { user_id: user.id, household_id: authCheck.household_id, relative_id: alertData.user_id }
      });
      return new Response(JSON.stringify({ error: 'Unauthorized access' }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Get approved family contacts only (no arbitrary recipients)
    let familyContacts: string[] = [];
    // Fetch family contacts from relatives table (secure access only)
    const { data: relativeData, error: relativeError } = await supabase.rpc('get_relative_escalation_contacts', {
      relative_id_param: alertData.user_id
    });

    if (relativeError) {
      console.error('Error fetching relative data:', relativeError);
    } else if (relativeData && relativeData.length > 0) {
      const contact = relativeData[0];
      if (contact.escalation_contact_email) {
        familyContacts.push(contact.escalation_contact_email);
      }
    }

    // Get household members' emails from the same household only
    const { data: householdMembers, error: memberHouseholdError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', authCheck.household_id)
      .neq('user_id', user.id); // Exclude the requesting user

    if (!memberHouseholdError && householdMembers) {
      for (const member of householdMembers) {
        // In a real implementation, get emails from auth.users
        // For security, we only send to verified household members
        familyContacts.push(`member-${member.user_id}@household-verified.com`);
      }
    }

    console.log('Family contacts to notify:', familyContacts);

    // Send email notifications using Resend
    const emailResults = [];
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (RESEND_API_KEY && familyContacts.length > 0) {
      for (const contact of familyContacts) {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'CallPanion <alerts@callpanion.com>',
              to: [contact],
              subject: `CallPanion Alert: ${alertData.user_name}`,
              html: generateEmailHTML(alertData),
            }),
          });

          const emailResult = await emailResponse.json();
          emailResults.push({
            contact,
            success: emailResponse.ok,
            result: emailResult,
          });
          
          console.log(`Email sent to ${contact}:`, emailResult);
        } catch (error) {
          console.error(`Error sending email to ${contact}:`, error);
          emailResults.push({
            contact,
            success: false,
            error: error.message,
          });
        }
      }
    }

    // In a real implementation, you would also send SMS via Twilio here
    const smsResults = [];
    // Mock SMS sending for demonstration
    for (const contact of familyContacts.filter(c => c.startsWith('+'))) {
      smsResults.push({
        contact,
        success: true,
        message: 'SMS would be sent via Twilio',
      });
    }

    // Log the alert in database (you could create an alerts table)
    console.log('Alert processed successfully');

    return new Response(JSON.stringify({
      success: true,
      alert_id: crypto.randomUUID(),
      notifications_sent: emailResults.length + smsResults.length,
      email_results: emailResults,
      sms_results: smsResults,
      alert_data: alertData,
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Family alert function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});

function generateEmailHTML(alertData: AlertRequest): string {
  const severityColor = {
    low: '#10B981',
    medium: '#F59E0B', 
    high: '#EF4444',
    critical: '#DC2626'
  }[alertData.severity];

  const typeEmoji = {
    missed_calls: '📞',
    health_flag: '🏥',
    urgent_flag: '🚨',
    mood_alert: '💭'
  }[alertData.type];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>CallPanion Alert</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${severityColor}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">
          ${typeEmoji} CallPanion Alert
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">
          ${alertData.severity.toUpperCase()} PRIORITY
        </p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin-top: 0; color: #333;">
          Alert for ${alertData.user_name}
        </h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
          ${alertData.message}
        </p>
        <p style="font-size: 14px; color: #777; margin-bottom: 0;">
          Alert Type: ${alertData.type.replace('_', ' ').toUpperCase()}<br>
          Time: ${new Date().toLocaleString()}
        </p>
      </div>
      
      <div style="padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          This is an automated alert from CallPanion.<br>
          If this is an emergency, please contact emergency services immediately.
        </p>
      </div>
    </body>
    </html>
  `;
}