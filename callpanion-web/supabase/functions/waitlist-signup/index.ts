import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serviceClient } from '../_shared/client.ts';

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  if (!origin) return false;
  const allowlist = getAllowedOrigins();
  try {
    const o = new URL(origin);
    const host = o.hostname;
    if (allowlist.includes(o.origin)) return true;
    // Allow Lovable preview/staging domains by default
    if (host.endsWith('.lovable.app') || host.endsWith('.lovableproject.com') || host === 'localhost') return true;
    return false;
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
  };
}

interface WaitlistRequest {
  email: string;
  consent: boolean;
  consent_text: string;
  user_agent?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ip_hash?: string;
}

// Hash IP address for GDPR compliance
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  
  // Origin validation for enhanced security  
  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Access denied'
    }), {
      status: 403,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('Waitlist signup request received');
    console.log('Request method:', req.method);
    console.log('Request origin:', origin);
    
    const supabase = serviceClient();
    
    // Get client information for security logging
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    console.log('Client info:', { origin, ip, userAgent });
    
    // Simple origin validation (removed RPC call to non-existent function)
    console.log('Origin validation passed for:', origin);
    
    const requestData: WaitlistRequest = await req.json();
    console.log('Request data received:', { email: requestData.email, consent: requestData.consent });
    
    // Check if email already exists (idempotent operation)
    const emailLower = requestData.email.toLowerCase().trim();
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id, created_at')
      .eq('email', emailLower)
      .maybeSingle();
    
    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        message: 'You\'re already on our waitlist! Check your inbox to confirm your subscription.',
        id: existing.id,
      }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestData.email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email format'
      }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Check consent is given
    if (!requestData.consent) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Consent is required'
      }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Generate confirmation token
    const confirmToken = crypto.randomUUID();
    
    // Get client IP and hash it (GDPR compliant)
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
    const hashedIP = await hashIP(clientIP);

    // Insert into waitlist
    console.log('Attempting to insert waitlist entry:', {
      email: requestData.email.toLowerCase().trim(),
      consent: requestData.consent,
      consent_text: requestData.consent_text,
      hashedIP,
      user_agent: requestData.user_agent
    });

    const { data: insertData, error: insertError } = await supabase
      .from('waitlist')
      .insert([{
        email: requestData.email.toLowerCase().trim(),
        consent: requestData.consent,
        consent_text: requestData.consent_text,
        ip_hash: hashedIP,
        user_agent: requestData.user_agent,
        utm_source: requestData.utm_source,
        utm_medium: requestData.utm_medium,
        utm_campaign: requestData.utm_campaign,
        confirm_token: confirmToken,
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error details:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      
      // Handle duplicate email
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({
          success: false,
          error: 'This email is already on our waitlist'
        }), {
          status: 409,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }
      
      // Return more specific error information
      return new Response(JSON.stringify({
        success: false,
        error: `Database error: ${insertError.message}`,
        details: insertError.details || 'No additional details'
      }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    console.log('Waitlist entry created:', insertData.id);

    // Send confirmation email using Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SITE_URL = Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app') || 'https://callpanion.lovable.app';
    
    if (RESEND_API_KEY) {
      try {
        const confirmLink = `${SITE_URL}/confirm?token=${confirmToken}`;
        
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CallPanion <onboarding@resend.dev>',
            to: [requestData.email],
            subject: 'Confirm your CallPanion subscription',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <title>Confirm your CallPanion subscription</title>
              </head>
              <body style="font-family: 'Lato', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F7F4EF;">
                <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <img src="${SITE_URL}/lovable-uploads/38e53f64-a857-4a09-bd7b-3fd6af6d66ed.png" alt="CallPanion" style="height: 60px;">
                  </div>
                  
                  <h1 style="color: #0F3B2E; font-family: 'Playfair Display', serif; font-size: 24px; text-align: center; margin-bottom: 20px;">
                    Please confirm your subscription
                  </h1>
                  
                  <p style="color: #3E3E3E; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    Hi there,
                  </p>
                  
                  <p style="color: #3E3E3E; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    Please confirm you'd like updates about CallPanion by clicking the secure link below:
                  </p>
                  
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${confirmLink}" style="background-color: #0F3B2E; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      Confirm Subscription
                    </a>
                  </div>
                  
                  <p style="color: #3E3E3E; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    If you didn't request this, you can safely ignore this email.
                  </p>
                  
                  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 40px;">
                    <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
                      You're receiving this because you opted in at callpanion.co.uk<br>
                      © CallPanion Ltd, All rights reserved.
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `,
          }),
        });

        const emailResult = await emailResponse.json();
        console.log('Confirmation email sent:', emailResult);
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the signup if email fails
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Please check your inbox to confirm your subscription',
      id: insertData.id,
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Waitlist signup error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Unable to process signup. Please try again.',
    }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});