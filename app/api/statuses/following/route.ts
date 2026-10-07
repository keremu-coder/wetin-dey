export const runtime = "nodejs";

import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET — statuses from people I follow. Newest first, only people with
 * a non-empty status_line. Capped at 20.
 */
export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();

    const { data: follows } = await db
      .from("follows")
      .select("followed_session_id")
      .eq("follower_session_id", sessionId)
      .limit(100);

    const ids = (follows ?? [])
      .map((f) => f.followed_session_id)
      .filter(Boolean);

    if (ids.length === 0) {
      return Response.json({ people: [] });
    }

    const { data: sessions } = await db
      .from("sessions")
      .select(
        "handle, status_line, status_line_updated_at, availability, last_seen_at"
      )
      .in("id", ids)
      .not("status_line", "is", null)
      .order("status_line_updated_at", { ascending: false })
      .limit(20);

    const people = (sessions ?? [])
      .filter((s) => s.status_line && s.status_line.trim().length > 0)
      .map((s) => ({
        handle: s.handle,
        status_line: s.status_line,
        availability: s.availability ?? "auto",
        last_seen_at: s.last_seen_at
      }));

    return Response.json({ people });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}