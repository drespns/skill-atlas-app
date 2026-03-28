import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for browser scripts. Returns null if env vars are missing.
 * Server/build code should keep using `src/lib/supabase.ts` (throws if misconfigured).
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}
