export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { serverError } from "@/lib/http";

/**
 * Called by EmailVerificationHandler after the user clicks the Supabase
 * signup confirmation link. The access token from the URL fragment is
 * sent here, and we verify it against Supabase, then mark
 * sessions.email_verified_at.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const body = (await req.json()) as { access_token?: unknown };
    const accessToken =
      typeof body.access_token === "string" ? body.access_token : "";
    if (!accessToken) {
      return Response.json(
        { error: "access_token required" },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    const { data: userData, error: userErr } = await db.auth.getUser(
      accessToken
    );
    if (userErr || !userData?.user) {
      return Response.json({ error: "invalid token" }, { status: 400 });
    }

    const authUser = userData.user;
    if (!authUser.email_confirmed_at) {
      return Response.json(
        { error: "email not confirmed yet" },
        { status: 400 }
      );
    }

    const { data: session } = await db
      .from("sessions")
      .select("id, auth_user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return Response.json({ error: "session not found" }, { status: 404 });
    }

    if (session.auth_user_id !== authUser.id) {
      return Response.json(
        { error: "token does not match this session" },
        { status: 403 }
      );
    }

    const { error: updErr } = await db
      .from("sessions")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (updErr) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[verify-email]", e);
    return serverError("auth/verify-email", e);
  }
}