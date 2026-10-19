export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId, getOrCreateSessionProfile, isValidHandleFormat } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  const sessionId = await getSessionId();
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const limit = await checkRateLimit(sessionId, {
    key: "join",
    limit: 5,
    windowMs: 60 * 60 * 1000
  }, { ip: getRequestIp(req) });
  if (!limit.ok) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let body: {
    email?: string;
    password?: string;
    handle?: string;
    terms_accepted?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const handle = String(body.handle ?? "").trim();
  const termsAccepted = body.terms_accepted === true;

  if (!termsAccepted) {
    return Response.json(
      {
        error:
          "You must agree to the Terms of Use and Community Guidelines before creating an account."
      },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Email no correct." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (!isValidHandleFormat(handle)) {
    return Response.json(
      { error: "Handle must be 3-20 characters. Letters, numbers, underscore only." },
      { status: 400 }
    );
  }

  const db = createServiceClient();

  const profile = await getOrCreateSessionProfile(sessionId, {
    bypassIpBan: true
  });
  if (!profile) {
    return Response.json({ error: "session profile failed" }, { status: 500 });
  }

  const handleLower = handle.toLowerCase();
  const { data: clash } = await db
    .from("sessions")
    .select("id")
    .eq("handle_lower", handleLower)
    .neq("id", sessionId)
    .maybeSingle();

  if (clash) {
    return Response.json(
      { error: "That handle don already dey. Try another one." },
      { status: 409 }
    );
  }

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

  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: false
  });

  if (authErr || !authData?.user) {
    const msg = authErr?.message ?? "unknown";
    console.error("[join] createUser failed:", msg);
    if (/already (registered|exists)/i.test(msg) || /duplicate/i.test(msg)) {
      return Response.json(
        { error: "That email don already dey for another account." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Could not create account." },
      { status: 500 }
    );
  }

  // Link the Auth user to this session row FIRST.
  const { data: linkedRows, error: updErr } = await db
    .from("sessions")
    .update({
      handle,
      handle_lower: handleLower,
      handle_kind: "named",
      display_name: handle,
      email,
      auth_provider: "email",
      auth_user_id: authData.user.id,
      accepted_terms_at: new Date().toISOString()
    })
    .eq("id", sessionId)
    .select("id");

  if (updErr || !linkedRows || linkedRows.length !== 1) {
    try {
      await db.auth.admin.deleteUser(authData.user.id);
    } catch (cleanupErr) {
      console.error("[join] orphan cleanup failed:", cleanupErr);
    }
    if (updErr?.code === "23505") {
      return Response.json(
        { error: "That handle don already dey. Try another one." },
        { status: 409 }
      );
    }
    console.error(
      "[join] session update failed:",
      updErr?.message ?? `matched ${linkedRows?.length ?? 0} rows, expected 1`
    );
    return Response.json(
      { error: "Account created but profile update failed." },
      { status: 500 }
    );
  }

  // Ask Supabase to send the confirmation email AFTER linking.
  let verificationEmailSent = false;
  try {
    const { error: resendErr } = await db.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://wetindey.app"}/auth/verify`
      }
    });
    if (resendErr) {
      console.warn("[join] resend confirmation failed:", resendErr.message);
    } else {
      verificationEmailSent = true;
    }
  } catch (e) {
    console.warn(
      "[join] resend confirmation threw:",
      (e as Error).message
    );
  }

  return Response.json({
    ok: true,
    handle,
    verification_email_sent: verificationEmailSent
  });
}

