import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotContactData {
  firstname?: string;
  lastname?: string;
  email: string;
  phone?: string;
  contact_role: string;
  household_id?: string;
  city?: string;
  state?: string;
  country?: string;
  signup_date: string;
  gdpr_consent_status: string;
  gdpr_consent_timestamp?: string;
}

interface WebhookPayload {
  type: 'household_created' | 'invite_accepted' | 'partner_added';
  data: HubSpotContactData;
  zapier_webhook_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function should only be called by authenticated database triggers
    // Check Authorization header for proper JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const payload: WebhookPayload = await req.json();
    console.log('HubSpot sync triggered:', payload.type, payload.data);

    // Default Zapier webhook URL (can be overridden per request)
    const zapierWebhookUrl = payload.zapier_webhook_url || Deno.env.get('ZAPIER_HUBSPOT_WEBHOOK_URL');

    if (!zapierWebhookUrl) {
      throw new Error('No Zapier webhook URL configured');
    }

    // Prepare HubSpot contact data
    const hubspotData = {
      ...payload.data,
      source: 'callpanion',
      trigger_type: payload.type,
      timestamp: new Date().toISOString(),
    };

    console.log('Sending to Zapier:', hubspotData);

    // Send to Zapier webhook
    const zapierResponse = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hubspotData),
    });

    if (!zapierResponse.ok) {
      throw new Error(`Zapier webhook failed: ${zapierResponse.status} ${zapierResponse.statusText}`);
    }

    console.log('Successfully sent to HubSpot via Zapier');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Contact synced to HubSpot successfully',
        trigger_type: payload.type 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('HubSpot sync error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});