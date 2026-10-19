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

export type DedupeInput = {
  category: string;
  agency_canonical: string;
  state: string;
  lga?: string | null;
};

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

function normalizeIpForBucket(ip: string): string {
  const trimmed = ip.trim();
  if (!trimmed.includes(":")) return trimmed;

  if (trimmed.toLowerCase().startsWith("::ffff:")) {
    return trimmed.slice(7);
  }

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
      return { ok: false, retryAfterMs: 60_000 };
    }

    if ((count ?? 0) >= rule.limit) {
      return { ok: false, retryAfterMs: rule.windowMs };
    }

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

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://wetindey.app",
  "https://wetin-dey-gamma.vercel.app",
  "https://wetindey.vercel.app",
  "https://tindey.vercel.app",
  "https://wetindey.app",
  "https://www.wetindey.app"
];

export async function checkIpRateLimit(
  req: Request,
  rule: Rule
): Promise<RateLimitResult> {
  const ip = getRequestIp(req);
  if (!ip) {
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
    try {
      return ALLOWED_ORIGINS.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return false;
}
