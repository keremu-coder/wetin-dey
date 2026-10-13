export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { signSessionId, sessionCookieOptions } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/constants";
import { sameOrigin, checkIpRateLimit } from "@/lib/rate-limit";

const BAD_LOGIN = "Email or password no correct.";

/** Escape LIKE wildcards so an email can only ever match itself. */
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => "\\" + c);
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  // Throttle every attempt per IP before touching auth.
  const limit = await checkIpRateLimit(req, {
    key: "signin",
    limit: 10,
    windowMs: 15 * 60 * 1000
  });
  if (!limit.ok) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password || email.length > 254 || password.length > 256) {
    return Response.json({ error: "Email and password required." }, { status: 400 });
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: authData, error: authErr } =
    await anonClient.auth.signInWithPassword({ email, password });

  if (authErr || !authData?.user) {
    return Response.json({ error: BAD_LOGIN }, { status: 401 });
  }

  const db = createServiceClient();

  // Prefer the stable auth_user_id; fall back to an exact (wildcard-escaped)
  // case-insensitive email match for rows that predate the backfill.
  let { data: profile, error: profileErr } = await db
    .from("sessions")
    .select("id, handle")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (!profile && !profileErr) {
    const res = await db
      .from("sessions")
      .select("id, handle")
      .ilike("email", escapeLike(email))
      .maybeSingle();
    profile = res.data;
    profileErr = res.error;
  }

  if (profileErr) {
    console.error("[signin] profile lookup failed:", profileErr.message);
    return Response.json({ error: "Server error" }, { status: 500 });
  }

  if (!profile) {
    // Server-side log only. Never return other users' data to the client.
    console.error("[signin] auth ok but no sessions row for auth user", authData.user.id);
    return Response.json({ error: BAD_LOGIN }, { status: 401 });
  }

  const cookieValue = await signSessionId(profile.id);
  cookies().set(COOKIE_NAME, cookieValue, sessionCookieOptions());

  return Response.json({ ok: true, handle: profile.handle });
}