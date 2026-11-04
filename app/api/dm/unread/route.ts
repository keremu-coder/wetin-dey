export const runtime = "nodejs";

import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET — total unread DM count across all threads. Used by the nav badge.
 */
export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ count: 0 });
    }

    const db = createServiceClient();

    const { data: threadsA } = await db
      .from("dm_threads")
      .select("id")
      .eq("session_a", sessionId);
    const { data: threadsB } = await db
      .from("dm_threads")
      .select("id")
      .eq("session_b", sessionId);

    const ids = [
      ...(threadsA ?? []).map((t) => t.id),
      ...(threadsB ?? []).map((t) => t.id)
    ];

    if (ids.length === 0) {
      return Response.json({ count: 0 });
    }

    const { count } = await db
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .in("thread_id", ids)
      .neq("sender_id", sessionId)
      .is("read_at", null)
      .eq("held", false);

    return Response.json({ count: count ?? 0 });
  } catch {
    return Response.json({ count: 0 });
  }
}