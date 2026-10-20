import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase env vars missing:', { 
      url: !!supabaseUrl, 
      key: !!supabaseAnonKey,
      NODE_ENV: process.env.NODE_ENV,
      urlValue: supabaseUrl,
      keyValue: supabaseAnonKey ? '[REDACTED]' : 'undefined'
    });
    throw new Error(`Supabase environment variables are not set. URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`);
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

let serviceInstance: SupabaseClient | null = null;

// Server-only client with the service role key, made on first use so that
// building the app does not need the keys.
export function getSupabaseServiceClient(): SupabaseClient {
  if (serviceInstance) {
    return serviceInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`Supabase environment variables are not set. URL: ${!!supabaseUrl}, service role key: ${!!serviceRoleKey}`);
  }

  serviceInstance = createClient(supabaseUrl, serviceRoleKey);
  return serviceInstance;
}

// Optional: For convenience if you need the client directly sometimes, but prefer the function call
// export const supabase = getSupabaseClient(); // This line would recreate the original problem in some contexts 