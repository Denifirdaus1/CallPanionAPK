
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return [
    'https://umjtepmdwfyfhdzbkyli.supabase.co',
    'https://loving-goldfinch-e42fd2.lovableproject.com',
    'https://callpanion.co.uk',
    'https://www.callpanion.co.uk'
  ];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  const allowlist = getAllowedOrigins();
  if (!origin) return false;
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
  const allowOrigin = allowed && origin ? origin : 'https://umjtepmdwfyfhdzbkyli.supabase.co';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  // Origin validation
  if (!isOriginAllowed(origin)) {
    return new Response('Forbidden origin', { 
      status: 403, 
      headers: corsHeaders(origin) 
    });
  }

  try {
    // Security Fix: Initialize Supabase client with JWT verification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
        }
      )
    }

    const { subscriptionID } = await req.json()
    const userID = user.id

    if (!subscriptionID || !userID) {
      return new Response(
        JSON.stringify({ error: 'Missing subscriptionID or userID' }),
        { 
          status: 400, 
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get PayPal access token
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const paypalBaseUrl = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.sandbox.paypal.com'

    if (!paypalClientId || !paypalClientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    // Get PayPal access token
    const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${paypalClientId}:${paypalClientSecret}`)}`
      },
      body: 'grant_type=client_credentials'
    })

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Verify subscription with PayPal
    const subscriptionResponse = await fetch(`${paypalBaseUrl}/v1/billing/subscriptions/${subscriptionID}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const subscriptionData = await subscriptionResponse.json()

    if (!subscriptionResponse.ok) {
      throw new Error(`PayPal API error: ${subscriptionData.message}`)
    }

    // Security Fix: Verify subscription belongs to authenticated user
    const subscriptionEmail = subscriptionData.subscriber?.email_address || subscriptionData.subscriber?.payer_id
    if (subscriptionEmail && subscriptionEmail !== user.email) {
      return new Response(
        JSON.stringify({ error: 'Subscription does not belong to authenticated user' }),
        { 
          status: 403, 
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user's household
    const { data: householdData } = await supabaseClient
      .from('household_members')
      .select('household_id')
      .eq('user_id', userID)
      .single()

    // Calculate trial end date (7 days from now)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7)

    // Calculate next billing date
    const nextBillingDate = new Date(subscriptionData.billing_info?.next_billing_time || trialEnd)

    // Store subscription in our database
    const { error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .insert({
        user_id: userID,
        household_id: householdData?.household_id,
        provider: 'paypal',
        provider_subscription_id: subscriptionID,
        plan_id: subscriptionData.plan_id,
        status: subscriptionData.status,
        trial_end: trialEnd.toISOString(),
        current_period_end: nextBillingDate.toISOString()
      })

    if (subscriptionError) {
      throw subscriptionError
    }

    // Update user's profile role to subscriber
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({ role: 'subscriber' })
      .eq('id', userID)

    if (profileError) {
      console.error('Failed to update profile role:', profileError)
      // Don't throw here as subscription is already created
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription: {
          id: subscriptionID,
          status: subscriptionData.status,
          trial_end: trialEnd.toISOString()
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Subscription confirmation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
      }
    )
  }
})
