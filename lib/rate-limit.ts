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
 * (local dev, unusual proxies) - callers treat null as "no IP signal".
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
 * activity. We never store the raw IP - only a salted hash. It's enough
 * to rate-limit the same client across sessions, and it disappears with
 * the rate_events row. If the service role key rotates, older IP-hash
 * buckets become unreachable - fine, since all windows are <= 1h.
 */
// Audit finding 8: an attacker on a home IPv6 connection has 2^64
// addresses available (one /64 prefix), and each address was a fresh
// bucket. Bucket IPv6 on the /64 prefix so rotation within the
// customer's block hits the same rate-limit counter.
function normalizeIpForBucket(ip: string): string {
  const trimmed = ip.trim();
  if (!trimmed.includes(":")) return trimmed; // IPv4 unchanged

  // IPv4-mapped IPv6 (::ffff:1.2.3.4) — bucket on the IPv4 part.
  if (trimmed.toLowerCase().startsWith("::ffff:")) {
    return trimmed.slice(7);
  }

  // Expand "::" so we can reliably take the first four segments.
  let expanded = trimmed.toLowerCase();
  if (expanded.includes("::")) {
    const parts = expanded.split("::");
    const before = parts[0] ? parts[0].split(":") : [];
    const after = parts[1] ? parts[1].split(":") : [];
    const missing = Math.max(0, 8 - before.length - after.length);
    const middle = Array(missing).fill("0");
    expanded = [...before, ...middle, ...after].join(":");
  }
  const segments = expanded.split(":");
  return segments.slice(0, 4).join(":") + "::/64";
}

export function hashIp(ip: string): string {
  // Fail closed: never fall back to a hardcoded string. A shared
  // default would make the IP-hash bucket reproducible across every
  // environment, letting an attacker pre-compute hashes.
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) {
    throw new Error("hashIp requires SUPABASE_SERVICE_ROLE_KEY as salt");
  }
  const bucket = normalizeIpForBucket(ip);
  return createHash("sha256")
    .update(`${salt}:${bucket}`)
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

  // Slow path: DB check for cross-instance abuse. Applies to every
  // limit at or below 100 - which is every security-sensitive endpoint
  // (signin, recovery, join, radar send, radar add-contact, report
  // upload). High-volume heartbeats with limits above 100 stay
  // memory-only to keep DB write volume bounded.
  if (rule.limit <= 100) {
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
      // to silently allow the request. Deny instead - the caller already
      // returns 429 with a retry hint.
      return { ok: false, retryAfterMs: 60_000 };
    }

    if ((count ?? 0) >= rule.limit) {
      return { ok: false, retryAfterMs: rule.windowMs };
    }

    // Best-effort insert. Failure here does not deny the request - the
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
 * - Missing Origin AND Referer -> deny. (Audit finding 7b: this used
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
  "https://wetindey.app",
  "https://wetin-dey-gamma.vercel.app",
  "https://wetindey.vercel.app",
  "https://wetindey.app",
  "https://www.wetindey.app"
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

/**
 * Same-origin check for state-changing routes.
 *
 * Origin is preferred: browsers send it on all cross-origin requests
 * and on same-origin POSTs from fetch/XHR. When Origin is absent we
 * fall back to Referer.
 *
 * Referer comparison is by parsed `.origin`, NOT string prefix. A
 * prefix check with `startsWith("https://wetindey.app")`
 * would accept `https://wetindey.app.evil.com/page` - the
 * attacker's DNS, matching your prefix. Parse and compare exactly.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (origin) {
    return ALLOWED_ORIGINS.includes(origin);
  }

  if (referer) {
    try {
      return ALLOWED_ORIGINS.includes(new URL(referer).origin);
    } catch {
      // Malformed Referer header - deny.
      return false;
    }
  }

  // Neither header present -> deny. Same-origin browsers always send
  // at least one of these for credentialed cross-document requests.
  return false;
}
