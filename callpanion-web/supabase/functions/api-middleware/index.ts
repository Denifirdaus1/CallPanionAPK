import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Middleware function to assert call method preference
 * Throws 403 error if household doesn't match required call method
 */
async function assertMode(householdId: string, required: 'batch_call' | 'in_app_call') {
  const supabase = serviceClient();
  
  const { data: household, error } = await supabase
    .from('households')
    .select('call_method_preference')
    .eq('id', householdId)
    .single();

  if (error) {
    throw new Response('Household not found', { status: 404 });
  }

  if (household.call_method_preference !== required) {
    throw new Response(
      JSON.stringify({
        error: 'Access forbidden',
        message: `This endpoint requires ${required} method, but household is configured for ${household.call_method_preference}`,
        required_method: required,
        current_method: household.call_method_preference
      }),
      { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  return household;
}

/**
 * Get user's household ID from authentication
 */
async function getUserHouseholdId(authHeader: string | null) {
  if (!authHeader) {
    throw new Response('Authentication required', { status: 401 });
  }

  const supabase = serviceClient();
  const token = authHeader.replace('Bearer ', '');
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw new Response('Invalid authentication', { status: 401 });
  }

  // Get household for this user
  const { data: households, error: householdError } = await supabase
    .from('households')
    .select('id')
    .eq('created_by', user.id)
    .limit(1);

  if (householdError || !households?.[0]) {
    throw new Response('No household found for user', { status: 404 });
  }

  return {
    userId: user.id,
    householdId: households[0].id
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { method, pathname } = new URL(req.url);
    
    // This is a utility function that other edge functions can import
    // Export the middleware functions for use in other edge functions
    if (method === 'POST' && pathname.includes('/assert-mode')) {
      const { household_id, required_method } = await req.json();
      await assertMode(household_id, required_method);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST' && pathname.includes('/get-household')) {
      const authHeader = req.headers.get('Authorization');
      const { userId, householdId } = await getUserHouseholdId(authHeader);
      
      return new Response(JSON.stringify({ user_id: userId, household_id: householdId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });

  } catch (error) {
    console.error('Error in api-middleware:', error);
    
    // If error is already a Response (from our assertMode function), return it
    if (error instanceof Response) {
      return error;
    }
    
    return new Response(JSON.stringify({ 
      error: 'middleware_error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Export functions for use in other edge functions
export { assertMode, getUserHouseholdId };