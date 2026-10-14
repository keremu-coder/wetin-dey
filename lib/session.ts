// lib/session.ts

import { nanoid } from "nanoid";
import { cookies, headers } from "next/headers";
import { COOKIE_NAME } from "./constants";
import {
  generateCleanHandle,
  generateFallbackHandle,
  generateLegacyHandle
} from "./handles";
import { createServiceClient } from "./supabase/server";
import { generateRecoveryCode, hashRecoveryCode } from "./recovery-code";

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET must be set to a long random string");
  }
  return s;
}

async function hmacBase64Url(subject: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(subject));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Cookie format:
 *   legacy (pre-epoch):  "<id>.<mac(id)>"
 *   current:             "<id>.<epoch>.<mac(id:epoch)>"
 *
 * The epoch is a monotonically-increasing integer stored on the session
 * row. Bumping it (signout, password reset, recovery-code rotation)
 * invalidates every previously-issued cookie for that session — that is
 * how we get real server-side revocation on top of a stateless HMAC
 * cookie. The MAC binds the epoch, so an attacker cannot forge a
 * different epoch value.
 */
async function sign(id: string, epoch: number): Promise<string> {
  const mac = await hmacBase64Url(`${id}:${epoch}`);
  return `${id}.${epoch}.${mac}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Parse and HMAC-verify a cookie value. Returns { id, epoch } or null.
 * Legacy 2-part cookies are accepted with epoch 1 for backward compat.
 */
async function parseSession(
  raw: string | undefined
): Promise<{ id: string; epoch: number } | null> {
  if (!raw) return null;
  const parts = raw.split(".");
  let id: string, epochStr: string | null, mac: string;

  if (parts.length === 2) {
    // Legacy: <id>.<mac(id)>
    id = parts[0];
    epochStr = null;
    mac = parts[1];
  } else if (parts.length === 3) {
    id = parts[0];
    epochStr = parts[1];
    mac = parts[2];
  } else {
    return null;
  }

  if (id.length < 8 || id.length > 64) return null;

  const epoch = epochStr === null ? 1 : Number(epochStr);
  if (!Number.isInteger(epoch) || epoch < 1 || epoch > 1_000_000) return null;

  const subject = epochStr === null ? id : `${id}:${epoch}`;
  const expected = await hmacBase64Url(subject);
  if (!constantTimeEqual(mac, expected)) return null;

  return { id, epoch };
}

/**
 * Legacy wrapper — returns just the id. Middleware uses this to decide
 * whether the inbound cookie is well-formed; it does NOT check the
 * epoch against the database (which happens in getSessionId below).
 */
export async function verifySessionValue(
  raw: string | undefined
): Promise<string | null> {
  const parsed = await parseSession(raw);
  return parsed?.id ?? null;
}

export async function issueSessionCookieValue(): Promise<{
  id: string;
  value: string;
}> {
  const id = nanoid();
  return { id, value: await sign(id, 1) };
}

/* ─── epoch lookup + cache ─────────────────────────────────────── */

type EpochEntry = { epoch: number; expiresAt: number };
const epochCache = new Map<string, EpochEntry>();
const EPOCH_CACHE_TTL_MS = 30_000;

/**
 * Read the current session_epoch for a session. Cached for 30 seconds
 * per instance so that most authenticated API calls skip the DB. On a
 * cache miss this is one indexed point lookup on the primary key.
 */
async function currentEpoch(sid: string): Promise<number | null> {
  const now = Date.now();
  const c = epochCache.get(sid);
  if (c && c.expiresAt > now) return c.epoch;

  const db = createServiceClient();
  const { data, error } = await db
    .from("sessions")
    .select("id, session_epoch")
    .eq("id", sid)
    .maybeSingle();

  if (error || !data) return null;
  const raw = (data as { session_epoch?: number | null }).session_epoch;
  const epoch = typeof raw === "number" && Number.isInteger(raw) ? raw : 1;
  epochCache.set(sid, { epoch, expiresAt: now + EPOCH_CACHE_TTL_MS });
  return epoch;
}

/**
 * Invalidate every previously-issued cookie for a session by bumping
 * its epoch. Call on signout, password reset, and recovery-code
 * rotation. Returns the new epoch, or null if the session is gone.
 *
 * Two concurrent bumps on the same instance may produce the same new
 * epoch (1 -> 2, 1 -> 2). That is acceptable — one bump is enough to
 * kill any previously-issued cookie, and bumping is a user-initiated
 * action that is not expected to happen in parallel.
 */
export async function bumpSessionEpoch(sid: string): Promise<number | null> {
  const db = createServiceClient();
  const current = await currentEpoch(sid);
  if (current === null) return null;
  const next = current + 1;
  const { error } = await db
    .from("sessions")
    .update({ session_epoch: next })
    .eq("id", sid);
  if (error) {
    console.error("[session] bumpSessionEpoch failed:", error.message);
    return null;
  }
  epochCache.set(sid, { epoch: next, expiresAt: Date.now() + EPOCH_CACHE_TTL_MS });
  return next;
}

/** Explicit cache eviction, in case a caller needs to force a re-read. */
export function invalidateEpochCache(sid: string): void {
  epochCache.delete(sid);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 90
  };
}

/**
 * Sign an existing session id for a returning user. Reads the current
 * epoch from the DB and signs with it, so the newly-issued cookie is
 * always fresh relative to any prior revocation.
 */
export async function signSessionId(id: string): Promise<string> {
  const epoch = await currentEpoch(id);
  if (epoch === null) throw new Error("session not found");
  return await sign(id, epoch);
}

/**
 * Read the cookie, verify HMAC, then confirm the epoch matches what is
 * stored on the session row. Epoch mismatch means the cookie was issued
 * before a revocation — return null so the caller treats the request as
 * unauthenticated.
 */
export async function getSessionId(): Promise<string | null> {
  const jar = await cookies();
  const parsed = await parseSession(jar.get(COOKIE_NAME)?.value);
  if (!parsed) return null;
  const dbEpoch = await currentEpoch(parsed.id);
  if (dbEpoch === null) return null;
  if (dbEpoch !== parsed.epoch) return null;
  return parsed.id;
}

export async function requireSessionId(): Promise<string> {
  const id = await getSessionId();
  if (!id) {
    throw new Error("no session");
  }
  return id;
}

export async function parseCookieHeader(
  cookieHeader: string | null
): Promise<string | null> {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) {
      return await verifySessionValue(rest.join("="));
    }
  }
  return null;
}

/* ─── handle validation ───────────────────────────────────────── */

export function isValidHandleFormat(handle: string): boolean {
  if (handle.length < 3 || handle.length > 20) return false;
  return /^[a-zA-Z0-9_]+$/.test(handle);
}

/* ─── session profile ─────────────────────────────────────────── */

export type SessionProfile = {
  id: string;
  handle: string;
  handle_kind: "anonymous" | "named";
  display_name: string | null;
  email: string | null;
  phone: string | null;
  auth_provider: string | null;
  bio: string | null;
  avatar_url: string | null;
  status_line?: string | null;
  recovery_code?: string | null;
  karma: number;
  verified_reporter: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  created_at: string;
};

async function uniqueRecoveryCode(
  db: ReturnType<typeof createServiceClient>
): Promise<{ raw: string; hash: string }> {
  for (let i = 0; i < 5; i++) {
    const candidate = generateRecoveryCode();
    const candidateHash = hashRecoveryCode(candidate);
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("recovery_code_hash", candidateHash)
      .maybeSingle();
    if (!data) return { raw: candidate, hash: candidateHash };
  }
  const fallback = generateRecoveryCode();
  return { raw: fallback, hash: hashRecoveryCode(fallback) };
}

/**
 * Read the inbound request IP and return its salted hash, or null if
 * the request is not in a context where headers are available
 * (build-time static generation, etc.).
 */
async function readRequestIpHash(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for") ?? "";
    const first = forwarded.split(",")[0]?.trim() ?? "";
    const ip = first || h.get("x-real-ip") || "";
    if (!ip) return null;
    const { hashIp } = await import("./rate-limit");
    return hashIp(ip);
  } catch {
    return null;
  }
}

export async function getOrCreateSessionProfile(
  sessionId: string,
  opts?: { bypassIpBan?: boolean }
): Promise<SessionProfile | null> {
  const db = createServiceClient();

  const { data: existing } = await db
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (existing) {
    if (!existing.recovery_code_hash) {
      try {
        const { hash: codeHash } = await uniqueRecoveryCode(db);
        const { data: updated } = await db
          .from("sessions")
          .update({ recovery_code_hash: codeHash })
          .eq("id", sessionId)
          .select("*")
          .single();
        if (updated) return updated as SessionProfile;
      } catch {
        /* fall through and return original */
      }
    }
    return existing as SessionProfile;
  }

  async function tryHandle(candidate: string): Promise<boolean> {
    const { data: clash } = await db
      .from("sessions")
      .select("id")
      .eq("handle", candidate)
      .maybeSingle();
    return !clash;
  }

  let handle: string | null = null;

  for (let i = 0; i < 8; i++) {
    const candidate = generateCleanHandle();
    if (await tryHandle(candidate)) {
      handle = candidate;
      break;
    }
  }
  if (!handle) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateFallbackHandle();
      if (await tryHandle(candidate)) {
        handle = candidate;
        break;
      }
    }
  }
  if (!handle) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateLegacyHandle();
      if (await tryHandle(candidate)) {
        handle = candidate;
        break;
      }
    }
  }
  if (!handle) {
    handle = `User_${Date.now().toString().slice(-6)}`;
  }

  // Ban evasion check. If this request's IP was banned in the last
  // 30 days and this is an anonymous session, refuse to create the
  // row. Signing up as a named user (bypassIpBan) is the escape
  // hatch: accountability via email instead of anonymity.
  let last_ip_hash: string | null = null;
  if (!opts?.bypassIpBan) {
    last_ip_hash = await readRequestIpHash();
    if (last_ip_hash) {
      const { data: banRow } = await db
        .from("banned_ip_hashes")
        .select("ip_hash")
        .eq("ip_hash", last_ip_hash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (banRow) {
        console.warn("[session] refused new session from banned IP");
        return null;
      }
    }
  }

  const { hash: recovery_code_hash } = await uniqueRecoveryCode(db);

  const { data: created, error } = await db
    .from("sessions")
    .insert({
      id: sessionId,
      handle,
      handle_kind: "anonymous",
      auth_provider: "none",
      recovery_code_hash,
      last_ip_hash
    })
    .select("*")
    .single();

  if (error) {
    console.error("session create failed:", error);
    return null;
  }

  return created as SessionProfile;
}

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const id = await getSessionId();
  if (!id) return null;
  return await getOrCreateSessionProfile(id);
}