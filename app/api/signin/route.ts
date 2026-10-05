export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
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

  const db = createServiceClient();

  // Sign in with Supabase Auth
  const { data: authData, error: authErr } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (authErr || !authData?.user) {
    return Response.json(
      { error: "Email or password no correct." },
      { status: 401 }
    );
  }

  // Find the session row by email
  const { data: profile } = await db
    .from("sessions")
    .select("id, handle, handle_kind")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return Response.json(
      { error: "No profile found for this email." },
      { status: 404 }
    );
  }

  // Issue a new signed cookie pointing at this session id
  const cookieValue = await signSessionId(profile.id);
  const jar = cookies();
  jar.set(COOKIE_NAME, cookieValue, sessionCookieOptions());

  return Response.json({ ok: true, handle: profile.handle });
}