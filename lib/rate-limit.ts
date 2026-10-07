import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

// Simple in-memory rate limiter with a database fallback for
// serverless cold starts. In-memory is fast; the DB table catches
// cross-instance abuse.

type Bucket = {
  count: number;
  resetAt: number;
};

const memBuckets = new Map<string, Bucket>();

type Rule = {
  key: string;       // unique per session+endpoint
  limit: number;     // max requests
  windowMs: number;  // window length
};

/**
 * Returns true if the request is allowed, false if rate limited.
 * Also returns the ms until the window resets if limited.
 */
export async function checkRateLimit(
  sessionId: string,
  rule: Rule
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const now = Date.now();
  const bucketKey = `${sessionId}:${rule.key}`;

  // Fast path: check in-memory
  const mem = memBuckets.get(bucketKey);
  if (mem && mem.resetAt > now) {
    if (mem.count >= rule.limit) {
      return { ok: false, retryAfterMs: mem.resetAt - now };
    }
    mem.count += 1;
  } else {
    memBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + rule.windowMs
    });
  }

  // Slow path: also check the database for cross-instance abuse.
  // We only do this for limits of 10 or less to keep DB load low.
  if (rule.limit <= 10) {
    try {
      const db = createServiceClient();
      const sinceIso = new Date(now - rule.windowMs).toISOString();
      const { count } = await db
        .from("rate_events")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("bucket", rule.key)
        .gte("created_at", sinceIso);

      if ((count ?? 0) >= rule.limit) {
        return {
          ok: false,
          retryAfterMs: rule.windowMs
        };
      }

      // Fire and forget — don't block the response
      void db.from("rate_events").insert({
        session_id: sessionId,
        bucket: rule.key
      });
    } catch {
      // DB failure does not block the user
    }
  }

  return { ok: true };
}

/** Origin check for POST routes — returns true if request seems same-site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return true; // can't verify, allow
  const expected = `https://${host}`;
  if (origin && origin !== expected) return false;
  if (!origin && referer && !referer.startsWith(expected)) return false;
  return true;
}