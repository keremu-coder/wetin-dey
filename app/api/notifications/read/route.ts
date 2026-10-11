export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/read
 *
 * Body:
 *   { all: true }                  → mark every unread notification as read
 *   { id: "<uuid>" }               → mark one notification as read
 *
 * Only rows where recipient_id === the caller's session are ever touched.
 * Idempotent — re-marking an already-read row is a no-op.
 */
export async function POST(req: NextRequest) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const markAll = body?.all === true;
    const singleId = typeof body?.id === "string" ? body.id : null;

    if (!markAll && !singleId) {
      return Response.json(
        { error: "pass { all: true } or { id: '<uuid>' }" },
        { status: 400 }
      );
    }

    const db = createServiceClient();
    const now = new Date().toISOString();

    let q = db
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", sessionId)
      .is("read_at", null);

    if (singleId) {
      q = q.eq("id", singleId);
    }

    const { error } = await q;
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}