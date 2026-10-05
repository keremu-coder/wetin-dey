// lib/rateLimit.ts
// Dedupe hashing + stub rate limit functions.
// Real rate limiting is enforced by the Postgres trigger on public.reports
// and the RLS policies. The functions below exist only for API compatibility
// with callers that still import them.

import { createHash } from "crypto";

export type DedupeInput = {
  category: string;
  agency_canonical: string;
  state: string;
  lga?: string | null;
};

/**
 * Compute a dedupe hash for pattern detection.
 *
 * Two reports about the same agency, same category, same location,
 * in the same calendar week → same hash. This is what lets us say
 * "14th report against this office this week" without needing to know
 * who filed them.
 *
 * Deliberately NOT included:
 *  - session_id (would defeat the purpose)
 *  - body text (wording varies for the same complaint)
 *  - exact timestamp (would make every report unique)
 */
export function hashDedupe(input: DedupeInput): string {
  const weekBucket = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const parts = [
    input.category.toLowerCase().trim(),
    input.agency_canonical.toLowerCase().trim(),
    input.state.toLowerCase().trim(),
    (input.lga ?? "").toLowerCase().trim(),
    String(weekBucket)
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/* ─── Compatibility stubs ─────────────────────────────────
   These exist so existing API routes don't break on import.
   The real rate limiting is done at the database layer via:
     - Postgres trigger: reports_rate_limit (10 posts/hour per session)
     - RLS policies: session-scoped row access
   ──────────────────────────────────────────────────────── */

/** Legacy: in-memory rate limit does not work on Vercel (no shared memory).
 *  Kept only so /api/reports imports don't break. Always returns true.
 *  Real enforcement is the Postgres trigger. */
export function allowReport(_sessionId: string): boolean {
  return true;
}

/** Legacy: same as allowReport. Real enforcement via RLS + row count queries. */
export function allowComment(_sessionId: string): boolean {
  return true;
}

/** Legacy: same as allowReport. Real enforcement via Cloudflare or edge rate limits. */
export function allowPublicFeed(_ip: string): boolean {
  return true;
}