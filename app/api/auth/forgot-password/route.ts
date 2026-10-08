export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
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