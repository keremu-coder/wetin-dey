export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createFreshAnonClient, createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { serverError } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

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

  // Fresh client per request. setSession mutates the client's auth
  // state, so using the shared service-role singleton here would let
  // two concurrent requests on the same warm instance cross-wire
  // their sessions and change the wrong user's password.
  const tokenClient = createFreshAnonClient();

  const { error: sessionErr } = await tokenClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (sessionErr) {
    return Response.json(
      { error: "Reset link expired. Request a new one." },
      { status: 401 }
    );
  }

  // Resolve the user from the verified token, then update via the
  // admin API by user id. This keeps the password change pinned to the
  // exact user the token belongs to, with no shared mutable state.
  const { data: userRes, error: userErr } = await tokenClient.auth.getUser();
  if (userErr || !userRes?.user?.id) {
    return Response.json(
      { error: "Reset link expired. Request a new one." },
      { status: 401 }
    );
  }

  const admin = createServiceClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    userRes.user.id,
    { password }
  );

  if (updateErr) {
    return serverError("auth/reset-password", updateErr);
  }

  // Kill every previously-issued cookie for this user by bumping the
  // session epoch. A password reset means the user is recovering a
  // possibly-compromised account; any stolen cookie must die now.
  try {
    const adminDb = createServiceClient();
    const { data: rows } = await adminDb
      .from("sessions")
      .select("id")
      .eq("auth_user_id", userRes.user.id);
    const { bumpSessionEpoch } = await import("@/lib/session");
    for (const r of rows ?? []) {
      await bumpSessionEpoch((r as { id: string }).id);
    }
  } catch (e) {
    console.error("[reset-password] epoch bump failed:", e);
  }

  return Response.json({ ok: true });
}