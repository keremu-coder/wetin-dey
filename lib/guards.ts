import "server-only";
import { isBanned, BANNED_MESSAGE } from "./ban-guard";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "./terms-guard";

/**
 * Returns a Response to send back to the client if the session is NOT
 * allowed to write, or null if the session is allowed to proceed.
 *
 * Usage in a route:
 *
 *   const sessionId = await getSessionId();
 *   const denied = await assertCanWrite(sessionId);
 *   if (denied) return denied;
 *   // ... proceed
 *
 * Cheaper to reason about than two separate boolean checks, and it
 * guarantees the same 403 body shape everywhere.
 */
export async function assertCanWrite(
  sessionId: string | null
): Promise<Response | null> {
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  if (await isBanned(sessionId)) {
    return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
  }

  if (!(await hasAcceptedTerms(sessionId))) {
    return Response.json(
      { error: TERMS_NOT_ACCEPTED_MESSAGE, code: TERMS_NOT_ACCEPTED_CODE },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Ban-only guard, for routes that don't create content but should still
 * be blocked for banned users — voting, reacting. Terms acceptance is
 * not required just to upvote a post.
 */
export async function assertNotBanned(
  sessionId: string | null
): Promise<Response | null> {
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  if (await isBanned(sessionId)) {
    return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
  }

  return null;
}