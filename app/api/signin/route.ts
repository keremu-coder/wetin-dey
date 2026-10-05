export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { signSessionId, sessionCookieOptions } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/constants";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return Response.json({ error: "Email and password required." }, { status: 400 });
  }

  // ─── STEP 1: Verify the password with a FRESH anon client ───
  // Do NOT use the service role client here. Signing in changes the
  // client's identity, and the following query would then run under RLS.
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: authData, error: authErr } =
    await anonClient.auth.signInWithPassword({ email, password });

  if (authErr || !authData?.user) {
    return Response.json(
      { error: "Email or password no correct." },
      { status: 401 }
    );
  }

  // ─── STEP 2: Look up the session with the SERVICE ROLE client ───
  // This is a fresh, unauthenticated service-role client, so RLS is
  // bypassed and we can read the email column.
  const db = createServiceClient();

  const { data: profile, error: profileErr } = await db
    .from("sessions")
    .select("id, handle, handle_kind")
    .eq("email", email)
    .maybeSingle();

  if (profileErr) {
    return Response.json(
      { error: "Server error: " + profileErr.message },
      { status: 500 }
    );
  }

  if (!profile) {
    return Response.json(
      { error: "No profile found for this email." },
      { status: 404 }
    );
  }

  // ─── STEP 3: Issue the session cookie ───
  const cookieValue = await signSessionId(profile.id);
  const jar = cookies();
  jar.set(COOKIE_NAME, cookieValue, sessionCookieOptions());

  return Response.json({ ok: true, handle: profile.handle });
}