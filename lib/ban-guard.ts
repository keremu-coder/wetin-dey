import "server-only";
import { createServiceClient } from "./supabase/server";

/**
 * Returns true if the given session is banned from posting.
 *
 * A ban is a non-null banned_at timestamp on the sessions row. It does not
 * delete the account — the user can still read. It only blocks writes.
 *
 * Callers should return 403 with a clear message. Do not leak ban_reason
 * back to the user.
 */
export async function isBanned(sessionId: string | null): Promise<boolean> {
  if (!sessionId) return false;

  const db = createServiceClient();
  const { data } = await db
    .from("sessions")
    .select("banned_at")
    .eq("id", sessionId)
    .maybeSingle();

  return data?.banned_at != null;
}

export const BANNED_MESSAGE =
  "Your account is paused and can't post right now. Contact support@wetindey.app if you think this is a mistake.";