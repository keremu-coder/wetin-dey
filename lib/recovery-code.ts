// Recovery codes. Human-copyable format: ABCD-EFGH-IJKL-MNPQ
// Alphabet excludes confusables: no 0/O, no 1/I/L.

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUPS = 4;
const GROUP_LEN = 4;
const CODE_LEN = GROUPS * GROUP_LEN; // 16

export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < CODE_LEN; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let raw = "";
  for (let i = 0; i < CODE_LEN; i++) {
    raw += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return raw;
}

/** Add dashes every 4 chars. ABCDEFGHIJKLMNPQ → ABCD-EFGH-IJKL-MNPQ */
export function formatRecoveryCode(raw: string): string {
  const clean = normalizeRecoveryCode(raw);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += GROUP_LEN) {
    parts.push(clean.slice(i, i + GROUP_LEN));
  }
  return parts.join("-");
}

/** Uppercase, strip everything that isn't in the alphabet. */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("")
    .slice(0, CODE_LEN);
}

/** True if the input looks like a complete, well-formed code. */
export function isValidRecoveryCodeFormat(input: string): boolean {
  return normalizeRecoveryCode(input).length === CODE_LEN;
}
/**
 * HMAC-SHA256 of the normalized recovery code, hex-encoded.
 *
 * Why HMAC and not plain SHA-256: the code space (30^16 ≈ 2^78) is
 * large enough that a plain hash would resist a rainbow table, but
 * keying it with a server-side secret means a leaked database dump is
 * useless even if the attacker has a precomputed table, and the same
 * hash never appears across environments. The secret lives in
 * RECOVERY_HASH_SECRET, never in the repo.
 *
 * Throws if the secret is missing. Callers must not catch-and-continue
 * on this — a missing secret in any environment is a deploy failure,
 * not a runtime recoverable condition.
 */
export function hashRecoveryCode(raw: string): string {
  const key = process.env.RECOVERY_HASH_SECRET;
  if (!key) {
    throw new Error(
      "RECOVERY_HASH_SECRET is not set — cannot hash recovery codes"
    );
  }
  const normalized = normalizeRecoveryCode(raw);
  // Lazy import so this file stays importable from edge runtimes that
  // don't expose node:crypto. All call sites are node-runtime routes.
  const { createHmac } = require("crypto") as typeof import("crypto");
  return createHmac("sha256", key).update(normalized).digest("hex");
}

/**
 * Constant-time comparison of a raw code against a stored hash.
 *
 * Returns false on any parse error or length mismatch — never throws.
 */
export function verifyRecoveryCode(raw: string, storedHash: string): boolean {
  try {
    const computed = hashRecoveryCode(raw);
    if (computed.length !== storedHash.length) return false;
    const { timingSafeEqual } = require("crypto") as typeof import("crypto");
    return timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}