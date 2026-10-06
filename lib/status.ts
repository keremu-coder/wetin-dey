// lib/status.ts
// BBM-style status line. A short, low-pressure mood line under every handle.

export const STATUS_MAX_LENGTH = 60;
export const STATUS_MIN_LENGTH = 1;

export function isValidStatus(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const trimmed = input.trim();
  if (trimmed.length < STATUS_MIN_LENGTH) return false;
  if (trimmed.length > STATUS_MAX_LENGTH) return false;
  return true;
}

export function normalizeStatus(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, STATUS_MAX_LENGTH);
}