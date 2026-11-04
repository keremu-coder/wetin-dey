export const runtime = "nodejs";

import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications/unread
 *
 * Returns the current session's unread notification count. Used by the
 * bell badge in Nav.tsx. Polled every 30s via LiveStateProvider.
 */
export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ count: 0 });
    }

    const db = createServiceClient();

    const { count, error } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", sessionId)
      .is("read_at", null);

    if (error) {
      return Response.json({ count: 0 });
    }

    return Response.json({ count: count ?? 0 });
  } catch {
    return Response.json({ count: 0 });
  }
}