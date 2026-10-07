// Contact-info filter for DMs.
//
// Purpose: prevent users from moving a conversation off-platform. Nigerian
// social-app scams almost always begin with "send me your number" or "let's
// talk on WhatsApp" — once contact info is exchanged, the platform loses the
// ability to moderate and the victim has no recourse.
//
// The filter classifies a message into three levels:
//   pass   — no contact info detected, deliver as-is
//   warn   — suspicious but ambiguous, deliver with a small nudge
//   block  — clear contact info, do not deliver; show the sender a warning
//
// This file only classifies. Enforcement (hold, restrict, suspend) is the
// caller's responsibility and lives in the API route.

export type FilterLevel = "pass" | "warn" | "block";

export type FilterKind =
  | "phone"
  | "spelled_phone"
  | "email"
  | "spelled_email"
  | "external_link";

export type FilterMatch = {
  kind: FilterKind;
  text: string;
  index: number;
};

export type FilterResult = {
  level: FilterLevel;
  matches: FilterMatch[];
  reasons: string[];
};

/* ───────────── Normalization helpers ───────────── */

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9"
};

function collapseSpelledDigits(text: string): string {
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const word = parts[i];
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (DIGIT_WORDS[clean] !== undefined) {
      const digits: string[] = [];
      let j = i;
      while (j < parts.length) {
        const w = parts[j];
        if (/^\s+$/.test(w)) {
          j++;
          continue;
        }
        const c = w.toLowerCase().replace(/[^a-z]/g, "");
        if (DIGIT_WORDS[c] === undefined) break;
        digits.push(DIGIT_WORDS[c]);
        j++;
      }
      if (digits.length >= 4) {
        out.push(digits.join(""));
        i = j;
      } else {
        out.push(word);
        i++;
      }
    } else {
      out.push(word);
      i++;
    }
  }
  return out.join("");
}

function stripSeparators(text: string): string {
  return text.replace(/[\s\-._()\[\],+]/g, "");
}

/* ───────────── Patterns ───────────── */

const NG_PHONE_LOCAL = /0[7-9][0-1]\d{8}/;
const NG_PHONE_INTL = /234[7-9][0-1]\d{8}/;

const EMAIL_STANDARD = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;

const EMAIL_SPELLED_DOT =
  /\b[a-z0-9._%+\-]{2,}\s+at\s+[a-z0-9\-]{2,}\s+dot\s+[a-z]{2,}\b/i;

const EMAIL_SPELLED_AT =
  /\b[a-z0-9._%+\-]{2,}\s+at\s+[a-z0-9\-]{2,}\.[a-z]{2,}\b/i;

const EXTERNAL_DOMAINS = [
  "wa\\.me",
  "whatsapp\\.com",
  "t\\.me",
  "telegram\\.me",
  "telegram\\.org",
  "instagram\\.com",
  "twitter\\.com",
  "x\\.com",
  "facebook\\.com",
  "fb\\.com",
  "snapchat\\.com",
  "tiktok\\.com",
  "threads\\.net",
  "signal\\.me",
  "discord\\.gg",
  "discord\\.com",
  "linkedin\\.com"
];

const EXTERNAL_LINK = new RegExp(
  "(?:https?://)?(?:www\\.)?(?:" + EXTERNAL_DOMAINS.join("|") + ")(?:/[^\\s]*)?",
  "i"
);

/* ───────────── Classification ───────────── */

export function analyzeMessage(raw: string): FilterResult {
  const matches: FilterMatch[] = [];
  const reasons: string[] = [];

  if (!raw || !raw.trim()) {
    return { level: "pass", matches, reasons };
  }

  // 1. External links FIRST. A wa.me/234... link is off-platform contact,
  //    and any phone number inside the URL is redundant. Blank out the
  //    link text so we never double-report the same contact as both
  //    a phone and a link.
  let body = raw;
  const link = raw.match(EXTERNAL_LINK);
  if (link && link.index !== undefined) {
    matches.push({
      kind: "external_link",
      text: link[0],
      index: link.index
    });
    reasons.push("Link to another platform detected.");
    body =
      raw.slice(0, link.index) +
      " ".repeat(link[0].length) +
      raw.slice(link.index + link[0].length);
  }

  // 2. Numeric phone numbers.
  const numeric = stripSeparators(body);
  const localPhone = numeric.match(NG_PHONE_LOCAL);
  if (localPhone) {
    matches.push({
      kind: "phone",
      text: localPhone[0],
      index: body.indexOf(localPhone[0].slice(0, 4))
    });
    reasons.push("Nigerian phone number detected.");
  }
  const intlPhone = numeric.match(NG_PHONE_INTL);
  if (intlPhone) {
    matches.push({
      kind: "phone",
      text: intlPhone[0],
      index: body.indexOf(intlPhone[0].slice(0, 3))
    });
    reasons.push("Nigerian phone number (international format) detected.");
  }

  // 3. Spelled-out phone numbers.
  const expanded = collapseSpelledDigits(body);
  const expandedNumeric = stripSeparators(expanded);
  const spelledLocal = expandedNumeric.match(NG_PHONE_LOCAL);
  if (spelledLocal && !localPhone) {
    matches.push({
      kind: "spelled_phone",
      text: spelledLocal[0],
      index: 0
    });
    reasons.push("Phone number spelled out in words.");
  }
  const spelledIntl = expandedNumeric.match(NG_PHONE_INTL);
  if (spelledIntl && !intlPhone && !spelledLocal) {
    matches.push({
      kind: "spelled_phone",
      text: spelledIntl[0],
      index: 0
    });
    reasons.push("Phone number (international) spelled out in words.");
  }

  // 4. Emails.
  const email = body.match(EMAIL_STANDARD);
  if (email) {
    matches.push({
      kind: "email",
      text: email[0],
      index: email.index ?? 0
    });
    reasons.push("Email address detected.");
  }
  const spelledEmail = body.match(EMAIL_SPELLED_DOT);
  if (spelledEmail) {
    matches.push({
      kind: "spelled_email",
      text: spelledEmail[0],
      index: spelledEmail.index ?? 0
    });
    reasons.push("Email address written with words ('at' / 'dot').");
  }
  const mixedEmail = body.match(EMAIL_SPELLED_AT);
  if (mixedEmail && !email) {
    matches.push({
      kind: "spelled_email",
      text: mixedEmail[0],
      index: mixedEmail.index ?? 0
    });
    reasons.push("Email address using spelled 'at'.");
  }

  // 5. Classify: any match is a block.
  const level: FilterLevel = matches.length > 0 ? "block" : "pass";

  return { level, matches, reasons };
}

/**
 * Convenience: returns the primary reason a message was blocked, for
 * display in the sender's warning dialog.
 */
export function blockReason(result: FilterResult): string | null {
  if (result.level === "pass" || result.matches.length === 0) return null;
  const first = result.matches[0];
  switch (first.kind) {
    case "phone":
    case "spelled_phone":
      return "Phone numbers can't be sent in DMs. Keep the conversation here.";
    case "email":
    case "spelled_email":
      return "Email addresses can't be sent in DMs. Keep the conversation here.";
    case "external_link":
      return "Links to other apps can't be sent in DMs. Keep the conversation here.";
  }
}