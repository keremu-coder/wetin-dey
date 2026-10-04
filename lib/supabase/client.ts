import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("missing supabase public env");
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
