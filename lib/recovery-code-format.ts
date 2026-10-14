// Client-safe recovery code formatting helpers.
//
// This file contains ONLY pure string operations. It has no
// require("crypto") anywhere, so it can be imported from Client
// Components without dragging the crypto polyfill (~318 KB) into the
// browser bundle. The HMAC hash + verify live in lib/recovery-code.ts
// and are only imported by Node-runtime API routes.

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUPS = 4;
const GROUP_LEN = 4;
const CODE_LEN = GROUPS * GROUP_LEN;

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

export function formatRecoveryCode(raw: string): string {
  const clean = normalizeRecoveryCode(raw);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += GROUP_LEN) {
    parts.push(clean.slice(i, i + GROUP_LEN));
  }
  return parts.join("-");
}

export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("")
    .slice(0, CODE_LEN);
}

export function isValidRecoveryCodeFormat(input: string): boolean {
  return normalizeRecoveryCode(input).length === CODE_LEN;
}