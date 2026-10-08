import "server-only";
import { createServiceClient } from "./supabase/server";

/**
 * Returns the set of session ids that the given session has a block
 * relationship with, in either direction.
 *
 * If A blocks B, then:
 *   - A should not see B's content
 *   - B should not see A's content
 *
 * So we return the union of both directions. Callers use this to filter
 * content they render. The current session is never included in the
 * result set (a session cannot block itself — enforced at the DB level
 * by the blocked_users_no_self constraint).
 *
 * Returns an empty Set for a null session id (visitor with no cookie),
 * so anonymous viewers still see everything.
 *
 * Fails open on DB error: a broken block lookup should not hide content
 * from the whole app. The failure is logged.
 */
export async function getBlockedIds(
  sessionId: string | null
): Promise<Set<string>> {
  if (!sessionId) return new Set();

  const db = createServiceClient();

  const { data, error } = await db
    .from("blocked_users")
    .select("blocker_session_id, blocked_session_id")
    .or(
      `blocker_session_id.eq.${sessionId},blocked_session_id.eq.${sessionId}`
    );

  if (error) {
    console.error("[blocks] getBlockedIds failed:", error.message);
    return new Set();
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.blocker_session_id === sessionId) {
      ids.add(row.blocked_session_id);
    }
    if (row.blocked_session_id === sessionId) {
      ids.add(row.blocker_session_id);
    }
  }
  return ids;
}

/**
 * Convenience: true if the given author session id is blocked by or
 * blocking the viewing session.
 */
export function isBlocked(
  authorSessionId: string | null,
  blocked: Set<string>
): boolean {
  if (!authorSessionId) return false;
  return blocked.has(authorSessionId);
}