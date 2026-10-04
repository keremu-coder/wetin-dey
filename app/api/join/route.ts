export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId, getOrCreateSessionProfile, isValidHandleFormat } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  console.log("=== POST /api/join START ===");

  const sessionId = await getSessionId();
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  let body: { email?: string; password?: string; handle?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const handle = String(body.handle ?? "").trim();

  // Validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Email no correct." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!isValidHandleFormat(handle)) {
    return Response.json(
      { error: "Handle must be 3–20 characters. Letters, numbers, underscore only." },
      { status: 400 }
    );
  }

  const db = createServiceClient();

  // Ensure profile row exists
  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) {
    return Response.json({ error: "session profile failed" }, { status: 500 });
  }

  // Check if handle is taken by someone else
  const { data: clash } = await db
    .from("sessions")
    .select("id")
    .eq("handle", handle)
    .neq("id", sessionId)
    .maybeSingle();

  if (clash) {
    return Response.json({ error: "That handle don already dey. Try another one." }, { status: 409 });
  }

  // Check if email already used
  const { data: emailClash } = await db
    .from("sessions")
    .select("id")
    .eq("email", email)
    .neq("id", sessionId)
    .maybeSingle();

  if (emailClash) {
    return Response.json(
      { error: "That email don already dey for another account." },
      { status: 409 }
    );
  }

  // Create Supabase Auth user (email confirmed = true, since we disable email verification)
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authErr || !authData?.user) {
    console.error("[auth] createUser failed:", authErr);
    return Response.json(
      { error: authErr?.message ?? "Could not create account." },
      { status: 500 }
    );
  }

  console.log("[auth] created user:", authData.user.id);

  // Upgrade the session row
  const { error: updErr } = await db
    .from("sessions")
    .update({
      handle,
      handle_kind: "named",
      display_name: handle,
      email,
      auth_provider: "email"
    })
    .eq("id", sessionId);

  if (updErr) {
    console.error("[db] session update failed:", updErr);
    return Response.json({ error: "Account created but profile update failed." }, { status: 500 });
  }

  console.log("=== POST /api/join SUCCESS ===");
  return Response.json({ ok: true, handle });
}