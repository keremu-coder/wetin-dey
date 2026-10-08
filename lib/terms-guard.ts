import "server-only";
import { createServiceClient } from "./supabase/server";

/**
 * Returns true if the session has accepted the Terms of Use and
 * Community Guidelines.
 *
 * Apple 1.2 and Google Play UGC policy both require an affirmative consent
 * before a user can post. All write routes gate on this.
 *
 * Existing sessions with accepted_terms_at = null are considered
 * not-accepted; the client shows a one-time consent gate that calls
 * /api/accept-terms to set it.
 */
export async function hasAcceptedTerms(
  sessionId: string | null
): Promise<boolean> {
  if (!sessionId) return false;

  const db = createServiceClient();
  const { data } = await db
    .from("sessions")
    .select("accepted_terms_at")
    .eq("id", sessionId)
    .maybeSingle();

  return data?.accepted_terms_at != null;
}

export const TERMS_NOT_ACCEPTED_CODE = "terms_not_accepted";
export const TERMS_NOT_ACCEPTED_MESSAGE =
  "You need to agree to the Terms of Use and Community Guidelines before posting.";