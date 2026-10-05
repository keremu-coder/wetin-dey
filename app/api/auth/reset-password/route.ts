export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let body: { password?: string; accessToken?: string; refreshToken?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const accessToken = String(body.accessToken ?? "");
  const refreshToken = String(body.refreshToken ?? "");

  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (!accessToken || !refreshToken) {
    return Response.json(
      { error: "Reset link invalid or expired. Request a new one." },
      { status: 400 }
    );
  }

  const db = createServiceClient();

  // Set the session on the client so updateUser knows who we are
  const { error: sessionErr } = await db.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (sessionErr) {
    return Response.json(
      { error: "Reset link expired. Request a new one." },
      { status: 401 }
    );
  }

  const { error: updateErr } = await db.auth.updateUser({ password });

  if (updateErr) {
    console.error("updateUser failed:", updateErr);
    return Response.json(
      { error: updateErr.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}