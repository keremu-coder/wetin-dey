export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkIpRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  // Throttle per IP. Without this an attacker can flood a victim's
  // inbox or burn the Resend quota by hammering this endpoint.
  const rl = await checkIpRateLimit(req, {
    key: "forgot_password",
    limit: 5,
    windowMs: 60 * 60 * 1000
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Email required." }, { status: 400 });
  }

  const db = createServiceClient();

  // If a session exists with this email but the email hasn't been
  // verified, do NOT send a reset link. We still return ok to avoid
  // leaking verification state to an attacker who can guess emails.
  const { data: session } = await db
    .from("sessions")
    .select("email_verified_at")
    .eq("email", email)
    .maybeSingle();

  if (session && !session.email_verified_at) {
    return Response.json({ ok: true });
  }

  await db.auth.resetPasswordForEmail(email, {
    redirectTo: "https://9jawatindey.vercel.app/reset-password"
  });

  // Always return ok — never reveal whether an email exists
  return Response.json({ ok: true });
}