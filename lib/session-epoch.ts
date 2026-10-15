// lib/session-epoch.ts
//
// Pure decision logic for the session-epoch check. No imports on purpose:
// it is unit-tested directly with node, and it must never touch the DB.
//
// Why this exists: getSessionId() used to return null whenever the
// sessions row was missing. But a brand-new visitor has a valid, signed
// cookie (issued by middleware) and NO row yet — the row is created later
// by getOrCreateSessionProfile(), which every caller only reaches after
// getSessionId() succeeds. The result was that no new visitor could ever
// get a row. A missing row must therefore be accepted for epoch-1 cookies.

export type EpochLookup =
  | { kind: "ok"; epoch: number }
  | { kind: "missing" } // query worked, no row for this id
  | { kind: "no-column" } // session_epoch column not migrated yet
  | { kind: "error" }; // transient failure (timeout, 429, network)

/**
 * Decide whether a signed cookie with `cookieEpoch` may be treated as an
 * authenticated session.
 *
 * - ok:         the stored epoch must equal the cookie's (revocation works).
 * - missing:    a first-time visitor. Only epoch-1 cookies qualify, because
 *               a bumped cookie (epoch > 1) can only come from a row that
 *               existed.
 * - no-column:  migration 026 not applied yet. Behave like epoch 1 for
 *               everyone so a deploy-before-migrate does not sign out the
 *               whole user base. Revocation is off until the migration runs.
 * - error:      fail closed, unless we hold a previously verified epoch for
 *               this id on this instance; then a DB blip does not sign
 *               everyone out.
 */
export function decideSession(
  cookieEpoch: number,
  lookup: EpochLookup,
  staleEpoch: number | null
): boolean {
  switch (lookup.kind) {
    case "ok":
      return lookup.epoch === cookieEpoch;
    case "missing":
    case "no-column":
      return cookieEpoch === 1;
    case "error":
      return staleEpoch !== null && staleEpoch === cookieEpoch;
  }
}

/**
 * Classify a Supabase/PostgREST error from the epoch lookup.
 * 42703 = undefined_column.
 */
export function isMissingEpochColumn(err: {
  code?: string;
  message?: string;
}): boolean {
  if (err.code === "42703") return true;
  return /session_epoch/i.test(err.message ?? "") && /column/i.test(err.message ?? "");
}

/**
 * Bounded cache pruning. Removes expired entries first, then the oldest
 * entries (Map keeps insertion order) until the map is under `max`.
 * Returns the number of entries removed.
 */
export function pruneEpochCache(
  cache: Map<string, { epoch: number; expiresAt: number }>,
  now: number,
  max: number
): number {
  if (cache.size <= max) return 0;
  let removed = 0;
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) {
      cache.delete(k);
      removed++;
    }
  }
  if (cache.size > max) {
    for (const k of cache.keys()) {
      if (cache.size <= max) break;
      cache.delete(k);
      removed++;
    }
  }
  return removed;
}
