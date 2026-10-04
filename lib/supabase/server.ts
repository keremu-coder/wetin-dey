import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function urlAndAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("missing supabase public env");
  }
  return { url, anon };
}

export function createAnonServerClient(): SupabaseClient {
  const { url, anon } = urlAndAnon();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function createServiceClient(): SupabaseClient {
  const { url } = urlAndAnon();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function withSession<T>(
  sessionId: string,
  fn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const client = createAnonServerClient();
  await client.rpc("set_app_session", { sid: sessionId });
  return fn(client);
}
