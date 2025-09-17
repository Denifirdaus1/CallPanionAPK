import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  email: string;
  type?: 'signup' | 'recovery';
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Test email function called with method:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type = 'signup' }: TestEmailRequest = await req.json();
    console.log("Testing email for:", email, "type:", type);

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let result;
    
    if (type === 'signup') {
      // Test signup with email confirmation
      console.log("Testing signup email for:", email);
      result = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { test_account: true }
      });
    } else {
      // Test password recovery email
      console.log("Testing recovery email for:", email);
      result = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${req.headers.get('origin') || 'http://localhost:3000'}/auth`
      });
    }

    console.log(`Test ${type} email result:`, result.error ? result.error.message : 'Success');

    return new Response(
      JSON.stringify({ 
        success: !result.error,
        message: result.error ? result.error.message : `Test ${type} email sent successfully`,
        data: result.data,
        timestamp: new Date().toISOString()
      }),
      {
        status: result.error ? 400 : 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Test email error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);