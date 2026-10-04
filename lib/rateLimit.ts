import { createHash } from "crypto";
import { COMMENTS_PER_HOUR, PUBLIC_FEED_PER_MIN, REPORTS_PER_HOUR } from "./constants";

type Bucket = { timestamps: number[] };

const memory = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number) {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = memory.get(key) ?? { timestamps: [] };
  prune(bucket, windowMs, now);
  if (bucket.timestamps.length >= limit) {
    memory.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  memory.set(key, bucket);
  return true;
}

export function allowReport(sessionId: string): boolean {
  return hit(`report:${sessionId}`, REPORTS_PER_HOUR, 60 * 60 * 1000);
}

export function allowComment(sessionId: string): boolean {
  return hit(`comment:${sessionId}`, COMMENTS_PER_HOUR, 60 * 60 * 1000);
}

export function allowPublicFeed(ip: string): boolean {
  const hashed = createHash("sha256").update(ip).digest("hex");
  return hit(`public:${hashed}`, PUBLIC_FEED_PER_MIN, 60 * 1000);
}

export function hashDedupe(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
