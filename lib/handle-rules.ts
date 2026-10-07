// Handle rules: validation, reserved names, rate limits.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const HANDLE_COOLDOWN_DAYS = 30;

// Exact-match reserved. Route prefixes + branded terms.
const RESERVED_EXACT = new Set([
  // routes
  "api", "admin", "signin", "signup", "join", "submit", "settings",
  "search", "explore", "radar", "talk", "community", "communities",
  "inbox", "me", "u", "r", "c", "support", "takedown", "privacy",
  "terms", "guidelines", "font", "disclaimer", "forgot", "reset",
  "sounds", "status", "notifications", "account", "security",
  "blocked", "data", "delete", "following", "agencies",
  // branding
  "wetindey", "wetin", "wetin_dey", "wetindey_official",
  // generic admin-style
  "official", "administrator", "root", "system", "staff", "mod",
  "moderator", "owner", "founder", "ceo", "help", "info", "www",
  "about", "contact", "team", "bot", "support_bot"
]);

// Substring check: if the handle contains any of these, reject.
const RESERVED_SUBSTRINGS = [
  "official",
  "admin",
  "support",
  "wetindey",
  "wetin_dey"
];

export type HandleValidationResult = {
  ok: boolean;
  reason: string;
  normalized: string;
};

export function validateHandle(raw: string): HandleValidationResult {
  const cleaned = raw.trim().toLowerCase().replace(/^@/, "");

  if (cleaned.length < HANDLE_MIN) {
    return {
      ok: false,
      reason: `Handle must be at least ${HANDLE_MIN} characters.`,
      normalized: cleaned
    };
  }
  if (cleaned.length > HANDLE_MAX) {
    return {
      ok: false,
      reason: `Handle must be ${HANDLE_MAX} characters or fewer.`,
      normalized: cleaned
    };
  }
  if (!/^[a-z0-9_]+$/.test(cleaned)) {
    return {
      ok: false,
      reason: "Only letters, numbers, and underscores.",
      normalized: cleaned
    };
  }
  if (cleaned.startsWith("_") || cleaned.endsWith("_")) {
    return {
      ok: false,
      reason: "Cannot start or end with an underscore.",
      normalized: cleaned
    };
  }
  if (/^_+$/.test(cleaned)) {
    return {
      ok: false,
      reason: "Handle cannot be all underscores.",
      normalized: cleaned
    };
  }
  if (/^\d+$/.test(cleaned)) {
    return {
      ok: false,
      reason: "Handle cannot be all numbers.",
      normalized: cleaned
    };
  }
  if (RESERVED_EXACT.has(cleaned)) {
    return {
      ok: false,
      reason: "That handle is reserved.",
      normalized: cleaned
    };
  }
  for (const sub of RESERVED_SUBSTRINGS) {
    if (cleaned.includes(sub)) {
      return {
        ok: false,
        reason: `Cannot contain "${sub}" — that looks like impersonation.`,
        normalized: cleaned
      };
    }
  }

  return { ok: true, reason: "", normalized: cleaned };
}

/** Days remaining on the cooldown, or 0 if the user can change now. */
export function cooldownDaysLeft(
  changedAt: string | null | undefined
): number {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
  const remaining = HANDLE_COOLDOWN_DAYS - elapsedDays;
  return remaining > 0 ? Math.ceil(remaining) : 0;
}