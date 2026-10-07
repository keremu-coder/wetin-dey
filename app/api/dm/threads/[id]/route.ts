export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Only show messages the recipient is allowed to see.
    // A held message is one the filter blocked. The sender sees it (with
    // a warning); the recipient never does.
    let q = db
      .from("dm_messages")
      .select("id, sender_id, body, filter_level, held, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(200);

    // Simple access rule: if the requester is the recipient of a held
    // message, hide it. Implemented as: fetch all non-held + the ones I sent
    // that are held.
    const { data: all } = await q;

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
        created_at: m.created_at
      }))
    });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}