import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Require authentication to prevent impersonation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting per user
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      _identifier: user.id,
      _endpoint: 'submit-content-report',
      _max_requests: 5,
      _window_minutes: 60
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const { contentType, contentId, reason, description, contentPreview } = await req.json();

    if (!contentType || !contentId || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: contentType, contentId, reason' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user can access the content being reported
    let hasAccess = false;
    
    if (contentType === 'family_photos' || contentType === 'family_messages') {
      const { data: content } = await supabase
        .from(contentType)
        .select('household_id')
        .eq('id', contentId)
        .single();
        
      if (content?.household_id) {
        const { data: isMember } = await supabase.rpc('app_is_household_member', {
          _household_id: content.household_id
        });
        hasAccess = !!isMember;
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Cannot report content you do not have access to' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the content report (server sets reported_by to prevent impersonation)
    const { error } = await supabase
      .from('content_reports')
      .insert({
        reported_by: user.id,  // Server-side, prevents impersonation
        content_type: contentType,
        content_id: contentId,
        reason,
        description,
        content_preview: contentPreview,
      });

    if (error) {
      console.error('Error inserting content report:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to submit report' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Log the report for monitoring (minimize PII)
    console.log('Content reported:', {
      reportedBy: user.id.substring(0, 8) + '...',
      contentType,
      reason,
      contentId: contentId.substring(0, 8) + '...'
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Report submitted successfully' }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in submit-content-report function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);