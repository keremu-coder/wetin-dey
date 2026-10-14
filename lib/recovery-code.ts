// Recovery code HMAC helpers — server only.
//
// All the pure string formatting lives in ./recovery-code-format so that
// Client Components can format and validate codes without pulling
// require("crypto") into the browser bundle. This file re-exports those
// helpers for convenience and adds the two functions that actually need
// Node crypto.

export {
  generateRecoveryCode,
  formatRecoveryCode,
  normalizeRecoveryCode,
  isValidRecoveryCodeFormat
} from "./recovery-code-format";

import { normalizeRecoveryCode } from "./recovery-code-format";

export function hashRecoveryCode(raw: string): string {
  const key = process.env.RECOVERY_HASH_SECRET;
  if (!key) {
    throw new Error(
      "RECOVERY_HASH_SECRET is not set — cannot hash recovery codes"
    );
  }
  const normalized = normalizeRecoveryCode(raw);
  const { createHmac } = require("crypto") as typeof import("crypto");
  return createHmac("sha256", key).update(normalized).digest("hex");
}

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