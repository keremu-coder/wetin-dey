import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Module-level singletons. Reused across all requests in the same
// serverless instance — no more per-request client creation.
let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

function urlAndAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("missing supabase public env");
  }
  return { url, anon };
}

export function createAnonServerClient(): SupabaseClient {
  if (anonClient) return anonClient;
  const { url, anon } = urlAndAnon();
  anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return anonClient;
}

export function createServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const { url } = urlAndAnon();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return serviceClient;
}

export async function withSession<T>(
  sessionId: string,
  fn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const client = createAnonServerClient();
  await client.rpc("set_app_session", { sid: sessionId });
  return fn(client);
}

/**
 * A *fresh* anon client, never cached. Use this for any flow that
 * calls auth.setSession() — setSession mutates the client's internal
 * auth state, so a shared singleton would let concurrent requests on
 * the same warm instance cross-wire their sessions.
 */
export function createFreshAnonClient(): SupabaseClient {
  const { url, anon } = urlAndAnon();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
