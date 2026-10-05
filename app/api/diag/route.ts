export const runtime = "nodejs";

import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const out: Record<string, unknown> = {};

  // 1. Are env vars present?
  out.has_url = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  out.has_service_key = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  out.service_key_prefix = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 12);
  out.url_value = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  // 2. Can we read the sessions table at all?
  try {
    const db = createServiceClient();
    const { data, error, count } = await db
      .from("sessions")
      .select("*", { count: "exact" })
      .limit(5);

    out.query_error = error ? { message: error.message, code: error.code } : null;
    out.session_count = count ?? null;
    out.session_sample = (data ?? []).map((s) => ({
      handle: s.handle,
      email: s.email,
      handle_kind: s.handle_kind
    }));
  } catch (e) {
    out.query_threw = (e as Error).message;
  }

  // 3. Try the exact query the signin route runs
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("sessions")
      .select("id, handle, handle_kind")
      .eq("email", "kpekpes@wetindey.app")
      .maybeSingle();
    out.specific_query_data = data;
    out.specific_query_error = error
      ? { message: error.message, code: error.code, details: error.details }
      : null;
  } catch (e) {
    out.specific_query_threw = (e as Error).message;
  }

  return Response.json(out);
}