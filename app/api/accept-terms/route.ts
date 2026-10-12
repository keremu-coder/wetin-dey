export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

/**
 * GET: Returns whether the current session has accepted the Terms of Use
 *      and Community Guidelines. Used by the client-side consent gate.
 *
 * POST: Records that the current session has accepted.
 *
 * New signups accept during /api/join and don't need either endpoint.
 * These exist to catch users who signed up before the terms column existed.
 */

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ accepted: false, has_session: false });
    }

    const db = createServiceClient();
    const { data } = await db
      .from("sessions")
      .select("accepted_terms_at")
      .eq("id", sessionId)
      .maybeSingle();

    return Response.json({
      accepted: data?.accepted_terms_at != null,
      has_session: true
    });
  } catch (e) {
    console.error("[accept-terms GET]", e);
    // Fail open — a broken status check shouldn't block the app.
    return Response.json({ accepted: true, has_session: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    let body: { accepted?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "bad json" }, { status: 400 });
    }

    if (body.accepted !== true) {
      return Response.json(
        { error: "You must accept the terms to continue." },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    const { error } = await db
      .from("sessions")
      .update({ accepted_terms_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[accept-terms POST]", e);
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}