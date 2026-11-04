// Guardrails for community/space names.
// Prevents empty, keyboard-mash, or trivially bad names from going public.

export const NAME_MIN = 3;
export const NAME_MAX = 40;
export const DESCRIPTION_MAX = 200;

const VOWELS = /[aeiouAEIOU]/;

/**
 * Common keyboard mash patterns to reject. Not exhaustive — the vowel
 * requirement catches most of it.
 */
function looksLikeMash(s: string): boolean {
  const letters = s.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) return false;

  // 5+ same letter in a row: "aaaaa"
  if (/([a-zA-Z])\1{4,}/.test(s)) return true;

  // 5+ consecutive consonants: "gakkljjh" — typical mash signature
  if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(letters)) {
    return true;
  }

  // Ratio of unique letters < 35% on strings of 8+: "gakkljjakkg"
  if (letters.length >= 8) {
    const unique = new Set(letters.toLowerCase()).size;
    if (unique / letters.length < 0.35) return true;
  }

  return false;
}

// Both branches include `reason` and `normalized` so callers never need
// discriminated-union narrowing — works regardless of tsconfig strict mode.
export type NameResult = {
  ok: boolean;
  reason: string;
  normalized: string;
};

export function validateCommunityName(raw: string): NameResult {
  const trimmed = raw.trim().replace(/\s+/g, " ");

  if (trimmed.length < NAME_MIN) {
    return {
      ok: false,
      reason: `Name must be at least ${NAME_MIN} characters.`,
      normalized: trimmed
    };
  }
  if (trimmed.length > NAME_MAX) {
    return {
      ok: false,
      reason: `Name must be ${NAME_MAX} characters or fewer.`,
      normalized: trimmed
    };
  }
  if (!/[a-zA-Z]/.test(trimmed)) {
    return {
      ok: false,
      reason: "Name must include at least one letter.",
      normalized: trimmed
    };
  }
  if (!VOWELS.test(trimmed)) {
    return {
      ok: false,
      reason: "Name must include at least one vowel (a, e, i, o, u).",
      normalized: trimmed
    };
  }
  if (looksLikeMash(trimmed)) {
    return {
      ok: false,
      reason:
        'That looks like keyboard mash. Try a real name like "Lagos Estate Watch".',
      normalized: trimmed
    };
  }

  return { ok: true, reason: "", normalized: trimmed };
}

export function validateCommunityDescription(raw: string): NameResult {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      reason: `Description must be ${DESCRIPTION_MAX} characters or fewer.`,
      normalized: trimmed
    };
  }
  return { ok: true, reason: "", normalized: trimmed };
}

/**
 * Turn a display name into a URL slug.
 * "Lagos Estate Watch" -> "lagos-estate-watch"
 */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}