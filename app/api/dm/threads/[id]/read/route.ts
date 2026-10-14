export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/http";

/**
 * POST — mark every message the OTHER person sent in this thread as read.
 * Idempotent. Called on thread open, on new message arrival, and on tab focus.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();

    const { data: thread } = await db
      .from("dm_threads")
      .select("id, session_a, session_b")
      .eq("id", params.id)
      .maybeSingle();

    if (!thread) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (thread.session_a !== sessionId && thread.session_b !== sessionId) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    // Mark all messages from the other person that aren't yet read.
    const { error } = await db
      .from("dm_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", thread.id)
      .neq("sender_id", sessionId)
      .is("read_at", null);

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return serverError("dm/threads/[id]/read", e);
  }
}