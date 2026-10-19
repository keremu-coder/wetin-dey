// Content filter for Wetin Dey.
//
// Two classifiers live here:
//
//   1. analyzeMessage()   â€” contact-info detection, used by DMs. Prevents
//                           moving a conversation off-platform. Unchanged.
//
//   2. analyzeModeration() â€” profanity / hate / threat detection, used by
//                           community chat and comments. Held for moderator
//                           review when matched.
//
// Both only classify. Enforcement (hold, hide, reject) lives in the caller.

export type FilterLevel = "pass" | "warn" | "block";

export type FilterKind =
  | "phone"
  | "spelled_phone"
  | "email"
  | "spelled_email"
  | "external_link"
  | "profanity"
  | "hate"
  | "threat";

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Normalization helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Contact-info patterns (DMs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const NG_PHONE_LOCAL = /0[7-9][0-1]\d{8}/;
const GLOBAL_PHONE = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Moderation patterns (chat + comments) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// Common high-signal profanity. Deliberately conservative â€” Pidgin slang
// like "wahala", "abeg", "yeye" is NOT profanity and must not be flagged.
const PROFANITY: RegExp[] = [
  /\bf+u+c+k+(ing|er|ed)?\b/i,
  /\bshit+(ty|ting)?\b/i,
  /\bbitch(es|ass)?\b/i,
  /\basshole(s)?\b/i,
  /\bbastard(s)?\b/i,
  /\bcunt(s)?\b/i,
  /\bdickhead(s)?\b/i,
  /\bmotherfuck(er|ing)?\b/i
];

// Threat language. Requires a violent verb + a target to reduce false
// positives like "this exam will kill me".
const THREAT: RegExp[] = [
  /\b(i|we)\s+(will|go|gonna|wan|want\s+to)\s+(kill|murder|shoot|stab|burn|behead)\s+(you|u|him|her|them|your|his|her|their)\b/i,
  /\b(i|we)\s+(will|go|gonna|wan|want\s+to)\s+(beat|flog|deal\s+with)\s+(you|u|him|her|them)\s+up\b/i,
  /\bi\s+go\s+(kill|shoot|stab|burn)\s+(you|u|am)\b/i,
  /\bi\s+know\s+where\s+you\s+(live|dey|stay)\b/i,
  /\byou\s+(go|will)\s+die\b/i,
  /\b(we|dem)\s+go\s+kill\s+(you|u|am)\b/i
];

// Hate patterns. Only high-signal "kill all [group]" style â€” no slur list,
// for legal and false-positive reasons. A moderator-curated list can be
// added later.
const HATE: RegExp[] = [
  /\b(kill|wipe\s+out|exterminate|eliminate)\s+all\s+(the\s+)?[a-z]{3,}s?\b/i,
  /\b[a-z]{3,}s?\s+(are|na)\s+(animals|dogs|pigs|monkeys|vermin)\b/i,
  /\bdeath\s+to\s+(all\s+)?[a-z]{3,}s?\b/i
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Contact-info classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function analyzeMessage(raw: string): FilterResult {
  const matches: FilterMatch[] = [];
  const reasons: string[] = [];

  if (!raw || !raw.trim()) {
    return { level: "pass", matches, reasons };
  }

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

  const level: FilterLevel = matches.length > 0 ? "block" : "pass";

  return { level, matches, reasons };
}

/**
 * Convenience: returns the primary reason a DM was blocked, for
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
    default:
      return null;
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Moderation classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type ModerationResult = {
  hold: boolean;
  matches: FilterMatch[];
  reasons: string[];
};

export function analyzeModeration(raw: string): ModerationResult {
  const matches: FilterMatch[] = [];
  const reasons: string[] = [];

  if (!raw || !raw.trim()) {
    return { hold: false, matches, reasons };
  }

  for (const rx of PROFANITY) {
    const m = raw.match(rx);
    if (m && m.index !== undefined) {
      matches.push({ kind: "profanity", text: m[0], index: m.index });
      reasons.push("Profanity detected.");
      break;
    }
  }

  for (const rx of THREAT) {
    const m = raw.match(rx);
    if (m && m.index !== undefined) {
      matches.push({ kind: "threat", text: m[0], index: m.index });
      reasons.push("Threat of violence detected.");
      break;
    }
  }

  for (const rx of HATE) {
    const m = raw.match(rx);
    if (m && m.index !== undefined) {
      matches.push({ kind: "hate", text: m[0], index: m.index });
      reasons.push("Hate speech pattern detected.");
      break;
    }
  }

  return { hold: matches.length > 0, matches, reasons };
}

/**
 * A short, user-facing reason string for held content.
 */
export function moderationReason(result: ModerationResult): string | null {
  if (!result.hold || result.matches.length === 0) return null;
  const first = result.matches[0];
  switch (first.kind) {
    case "threat":
      return "This message looks like a threat and is held for review.";
    case "hate":
      return "This message may violate our rules on hate speech and is held for review.";
    case "profanity":
      return "This message contains language that is held for review.";
    default:
      return "This message is held for review.";
  }
}

/**
 * Convenience enforcement helper.
 * Call this in your DM send route to determine if a message should be blocked.
 */
export function enforceDmPolicy(text: string) {
  const analysis = analyzeMessage(text);
  const mod = analyzeModeration(text);
  
  if (analysis.level === "block") {
    return {
      blocked: true,
      reason: blockReason(analysis) ?? "This message contains contact info and can't be sent.",
      kinds: analysis.matches.map((m) => m.kind),
    };
  }
  
  return {
    blocked: false,
    reason: null,
    hold: mod.hold,
    matches: mod.matches,
  };
}


