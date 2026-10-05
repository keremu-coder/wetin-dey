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

  await db.auth.resetPasswordForEmail(email, {
    redirectTo: "https://9jawatindey.vercel.app/reset-password"
  });

  // Always return ok — never reveal whether an email exists
  return Response.json({ ok: true });
}