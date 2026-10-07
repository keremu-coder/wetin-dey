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