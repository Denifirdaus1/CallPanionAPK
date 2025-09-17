import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

/**
 * Creates a Supabase service client with elevated permissions
 * for use in edge functions
 */
export function serviceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Gets the Elder app base URL from environment variables
 */
export function getElderAppBaseUrl(): string {
  const elderAppBaseUrl = Deno.env.get('ELDER_APP_BASE_URL');
  if (!elderAppBaseUrl) {
    throw new Error('Missing ELDER_APP_BASE_URL environment variable');
  }
  return elderAppBaseUrl;
}