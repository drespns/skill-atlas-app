import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for browser scripts. Returns null if env vars are missing.
 * Server/build code should keep using `src/lib/supabase.ts` (throws if misconfigured).
 */
let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  cached = createClient(url, anonKey);
  return cached;
}
