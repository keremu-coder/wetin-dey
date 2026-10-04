// lib/rateLimit.ts
// Only dedupe hashing lives here.
// Rate limiting is enforced by the Postgres trigger on public.reports,
// which works correctly across serverless invocations.

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