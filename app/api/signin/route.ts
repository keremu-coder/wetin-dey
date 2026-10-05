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

  // STEP 1: auth
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

  // STEP 2: lookup — case-insensitive, with diagnostics if it fails
  const db = createServiceClient();

  const { data: profile, error: profileErr } = await db
    .from("sessions")
    .select("id, handle, handle_kind, email")
    .ilike("email", email)
    .maybeSingle();

  if (profileErr) {
    return Response.json(
      { error: "Server error: " + profileErr.message },
      { status: 500 }
    );
  }

  if (!profile) {
    // Diagnostic: show every session handle + email so we can see the mismatch
    const { data: allSessions } = await db
      .from("sessions")
      .select("handle, email, handle_kind")
      .order("created_at", { ascending: false })
      .limit(20);

    return Response.json(
      {
        error: "No profile found for this email.",
        input_email: email,
        auth_user_id: authData.user.id,
        auth_user_email: authData.user.email,
        sessions_in_db: allSessions
      },
      { status: 404 }
    );
  }

  // STEP 3: cookie
  const cookieValue = await signSessionId(profile.id);
  const jar = cookies();
  jar.set(COOKIE_NAME, cookieValue, sessionCookieOptions());

  return Response.json({ ok: true, handle: profile.handle });
}