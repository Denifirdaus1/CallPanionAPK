import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  // Allow common email clients that may have null/unknown origins for unsubscribe links
  if (!raw) return [
    'https://umjtepmdwfyfhdzbkyli.supabase.co',
    'https://loving-goldfinch-e42fd2.lovableproject.com',
    'https://callpanion.co.uk',
    'https://www.callpanion.co.uk'
  ];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  // Allow null origin for email clients
  if (!origin) return true;
  
  const allowlist = getAllowedOrigins();
  try {
    const o = new URL(origin);
    return allowlist.includes(o.origin) ||
           o.hostname.endsWith('.lovableproject.com') ||
           o.hostname.endsWith('.lovable.app');
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  const allowed = isOriginAllowed(origin);
  // Allow null origin but provide a fallback
  const allowOrigin = allowed && origin ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response('Missing token parameter', { 
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'text/plain' },
      });
    }

    const supabase = serviceClient();
    
    // Get client information for security logging
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    // Log access with partial token for debugging
    await supabase.rpc('validate_origin_and_log', {
      _endpoint: 'unsubscribe',
      _origin: origin,
      _ip_address: ip,
      _user_agent: userAgent,
      _request_data: { token: token.substring(0, 20) + '...' }
    });
    
    // Rate limiting check
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      _identifier: ip,
      _endpoint: 'unsubscribe',
      _max_requests: 5,
      _window_minutes: 1
    });
    
    if (!rateLimitOk) {
      return new Response('Too many requests. Please try again later.', {
        status: 429,
        headers: { ...corsHeaders(origin), 'Content-Type': 'text/plain' }
      });
    }

    // Validate the signed token
    const { data: tokenValidation, error: tokenError } = await supabase.rpc('validate_unsubscribe_token', {
      token: token
    });

    if (tokenError || !tokenValidation || tokenValidation.length === 0 || !tokenValidation[0].is_valid) {
      console.error('Invalid unsubscribe token:', tokenError);
      return new Response('Invalid or expired unsubscribe link', {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'text/plain' }
      });
    }

    const email = tokenValidation[0].email;
    const SITE_URL = Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app') || 'https://callpanion.lovable.app';
    
    // Find and unsubscribe the email
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('email', email.toLowerCase().trim())
      .is('unsubscribed_at', null);

    if (updateError) {
      console.error('Error unsubscribing:', updateError);
      throw updateError;
    }

    console.log('Unsubscribed:', email);

    // Return success page HTML
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed - CallPanion</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;500;600&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Lato', Arial, sans-serif;
            background-color: #F7F4EF;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            max-width: 500px;
            width: 100%;
            padding: 60px 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            text-align: center;
          }
          .logo {
            height: 80px;
            margin-bottom: 30px;
          }
          h1 {
            font-family: 'Playfair Display', serif;
            color: #0F3B2E;
            font-size: 32px;
            margin-bottom: 20px;
          }
          p {
            color: #3E3E3E;
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .cta {
            background-color: #0F3B2E;
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            display: inline-block;
            margin-top: 20px;
          }
          .back-link {
            color: #C9A66B;
            text-decoration: none;
            font-weight: 500;
            margin-left: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="${SITE_URL}/lovable-uploads/38e53f64-a857-4a09-bd7b-3fd6af6d66ed.png" alt="CallPanion" class="logo">
          <h1>You've been unsubscribed</h1>
          <p>You've been unsubscribed from CallPanion updates. You can re-join any time from our homepage.</p>
          <a href="${SITE_URL}" class="cta">Back to Homepage</a>
        </div>
      </body>
      </html>
    `, {
      headers: { ...corsHeaders(origin), 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response('Unable to process unsubscribe. Please try again.', {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'text/plain' },
    });
  }
});