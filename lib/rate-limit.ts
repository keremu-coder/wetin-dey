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
  key: string;
  limit: number;
  windowMs: number;
};

// Both branches include retryAfterMs so callers never need discriminated
// union narrowing — works regardless of tsconfig strict mode.
export type RateLimitResult =
  | { ok: true; retryAfterMs: 0 }
  | { ok: false; retryAfterMs: number };

export async function checkRateLimit(
  sessionId: string,
  rule: Rule
): Promise<RateLimitResult> {
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
  // Only for tight limits (<=10) to keep DB load low.
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
        return { ok: false, retryAfterMs: rule.windowMs };
      }

      void db.from("rate_events").insert({
        session_id: sessionId,
        bucket: rule.key
      });
    } catch {
      // DB failure does not block the user
    }
  }

  return { ok: true, retryAfterMs: 0 };
}

/** Origin check for POST routes — returns true if request seems same-site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return true;
  const expected = `https://${host}`;
  if (origin && origin !== expected) return false;
  if (!origin && referer && !referer.startsWith(expected)) return false;
  return true;
}