import "server-only";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

// Simple in-memory rate limiter with a database fallback for
// serverless cold starts. In-memory is fast; the DB table catches
// cross-instance abuse.

type Bucket = {
  count: number;
  resetAt: number;
};

const memBuckets = new Map<string, Bucket>();
let writesSinceSweep = 0;
const SWEEP_EVERY_N_WRITES = 200;

/**
 * Lazy eviction of expired in-memory buckets.
 *
 * memBuckets is a plain Map that would otherwise grow unbounded on a
 * long-lived serverless instance: every unique client ip:hash or
 * session key creates an entry that never gets removed. Called every
 * SWEEP_EVERY_N_WRITES writes so the cost is amortized to near zero.
 */
function sweepExpiredBuckets(now: number): void {
  for (const [key, bucket] of memBuckets) {
    if (bucket.resetAt <= now) memBuckets.delete(key);
  }
}

type Rule = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; retryAfterMs: 0 }
  | { ok: false; retryAfterMs: number };

/**
 * Read the client IP from Vercel's forwarded headers.
 *
 * Vercel sets x-forwarded-for as a comma-separated list (client, proxy,
 * proxy, ...). The first entry is the original client. x-real-ip is a
 * single-value fallback. Returns null when neither header is present
 * (local dev, unusual proxies) — callers treat null as "no IP signal".
 */
export type DedupeInput = {
  category: string;
  agency_canonical: string;
  state: string;
  lga?: string | null;
};

/**
 * Dedupe hash for pattern detection. Two reports about the same agency,
 * same category, same location, same calendar week produce the same hash.
 * Deliberately excludes session_id, body text, and exact timestamp.
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

export function getRequestIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

/**
 * Deterministic hash of an IP, salted with the service role key.
 *
 * Why hash: SPEC.md rule 1 forbids logging IP addresses for anonymous
 * activity. We never store the raw IP — only a salted hash. It's enough
 * to rate-limit the same client across sessions, and it disappears with
 * the rate_events row. If the service role key rotates, older IP-hash
 * buckets become unreachable — fine, since all windows are <= 1h.
 */
function hashIp(ip: string): string {
  // Fail closed: never fall back to a hardcoded string. A shared
  // default would make the IP-hash bucket reproducible across every
  // environment, letting an attacker pre-compute hashes.
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) {
    throw new Error("hashIp requires SUPABASE_SERVICE_ROLE_KEY as salt");
  }
  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

async function checkBucket(
  bucketKey: string,
  rule: Rule
): Promise<RateLimitResult> {
  const now = Date.now();

  // Fast path: in-memory.
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
    writesSinceSweep += 1;
    if (writesSinceSweep >= SWEEP_EVERY_N_WRITES) {
      writesSinceSweep = 0;
      sweepExpiredBuckets(now);
    }
  }

  // Slow path: DB check for cross-instance abuse. Only for tight limits
  // to keep DB write volume low.
  if (rule.limit <= 10) {
    const db = createServiceClient();
    const sinceIso = new Date(now - rule.windowMs).toISOString();

    let count: number | null = null;
    let dbError = false;

    try {
      const { count: c, error } = await db
        .from("rate_events")
        .select("id", { count: "exact", head: true })
        .eq("session_id", bucketKey)
        .eq("bucket", rule.key)
        .gte("created_at", sinceIso);
      if (error) dbError = true;
      else count = c ?? 0;
    } catch {
      dbError = true;
    }

    if (dbError) {
      // Fail closed. The audit (finding 2) flagged that DB errors used
      // to silently allow the request. Deny instead — the caller already
      // returns 429 with a retry hint.
      return { ok: false, retryAfterMs: 60_000 };
    }

    if ((count ?? 0) >= rule.limit) {
      return { ok: false, retryAfterMs: rule.windowMs };
    }

    // Best-effort insert. Failure here does not deny the request — the
    // in-memory bucket already counted it.
    try {
      await db.from("rate_events").insert({
        session_id: bucketKey,
        bucket: rule.key
      });
    } catch {
      /* non-fatal */
    }
  }

  return { ok: true, retryAfterMs: 0 };
}

/**
 * Rate limit check, session-scoped plus optional IP-scoped.
 *
 * The session bucket prevents a single client from spamming. The IP
 * bucket (when opts.ip is passed) prevents the cookie-drop bypass the
 * audit documented: dropping the session cookie no longer resets the
 * limit, because the IP bucket accumulates across sessions.
 *
 * Both buckets must pass. Either failing returns ok: false.
 */
export async function checkRateLimit(
  sessionId: string,
  rule: Rule,
  opts?: { ip?: string | null }
): Promise<RateLimitResult> {
  const sessionKey = `${sessionId}:${rule.key}`;
  const sessionResult = await checkBucket(sessionKey, rule);
  if (!sessionResult.ok) return sessionResult;

  if (opts?.ip) {
    const ipKey = `ip:${hashIp(opts.ip)}:${rule.key}`;
    const ipResult = await checkBucket(ipKey, rule);
    if (!ipResult.ok) return ipResult;
  }

  return { ok: true, retryAfterMs: 0 };
}

/**
 * Origin check for POST routes. Fail-closed:
 *
 * - Missing Origin AND Referer → deny. (Audit finding 7b: this used
 *   to return true, which let header-stripping clients through.)
 * - Explicit allowlist only. No host-header synthesis, so a spoofed
 *   Host cannot manufacture a matching origin.
 * - Preview deploys and localhost are enumerated.
 *
 * When adding a new deploy URL, extend ALLOWED_ORIGINS rather than
 * weakening the check.
 */
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://9jawatindey.vercel.app",
  "https://wetin-dey-gamma.vercel.app",
  "https://wetindey.vercel.app"
];

export async function checkIpRateLimit(
  req: Request,
  rule: Rule
): Promise<RateLimitResult> {
  const ip = getRequestIp(req);
  if (!ip) {
    // No IP signal: fall back to a shared (strict) bucket rather than
    // allowing unlimited attempts.
    return checkBucket(`ip:unknown:${rule.key}`, rule);
  }
  return checkBucket(`ip:${hashIp(ip)}:${rule.key}`, rule);
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (origin) {
    return ALLOWED_ORIGINS.includes(origin);
  }

  if (referer) {
    return ALLOWED_ORIGINS.some((o) => referer.startsWith(o));
  }

  // Neither header present → deny. Same-origin browsers always send
  // at least one of these for credentialed cross-document requests.
  return false;
}