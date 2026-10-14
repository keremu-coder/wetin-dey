export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/http";

export async function GET(
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
      .select("id, session_a, session_b, created_at, last_message_at")
      .eq("id", params.id)
      .maybeSingle();

    if (!thread) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (thread.session_a !== sessionId && thread.session_b !== sessionId) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const otherId =
      thread.session_a === sessionId ? thread.session_b : thread.session_a;

    const { data: otherProfile } = await db
      .from("sessions")
      .select("id, handle, status_line, last_seen_at")
      .eq("id", otherId)
      .maybeSingle();

    const { data: all } = await db
      .from("dm_messages")
      .select(
        "id, sender_id, body, filter_level, held, created_at, read_at"
      )
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(200);

    const messages = (all ?? []).filter((m) => {
      if (!m.held) return true;
      return m.sender_id === sessionId;
    });

    return Response.json({
      thread: {
        id: thread.id,
        other_id: otherId,
        other_handle: otherProfile?.handle ?? "Anonymous",
        other_status_line: otherProfile?.status_line ?? null
      },
      messages: messages.map((m) => ({
        id: m.id,
        sender_id: m.sender_id,
        body: m.body,
        held: m.held,
        filter_level: m.filter_level,
        read_at: m.read_at,
        created_at: m.created_at
      }))
    });
  } catch (e) {
    return serverError("dm/threads/[id]", e);
  }
}