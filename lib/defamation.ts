// Heuristic defamation risk scorer.
//
// Applied to every report BEFORE it goes to the AI formalization step.
// Combined with the AI's own defamation flag, this gives us defense-in-depth:
// if either layer scores high, the report is held for manual review.
//
// This is a heuristic, not a legal opinion. It catches the obvious patterns.
// The AI catches the subtle ones. A human moderator catches the rest.
//
// C6 fix (audit):
//   - Removed /i from the two NAMED_INDIVIDUAL patterns. Case sensitivity
//     is load-bearing — with /i, [A-Z][a-z]+ matches any lowercase word,
//     so "he killed" matched the "named + accusation" pattern. Do not
//     add /i back.
//   - countMatches now uses \b word boundaries + a bounded suffix group,
//     so "kill" no longer matches "skill", "rape" no longer matches
//     "grape", "steal" no longer matches "stealership".
//   - Added unambiguous Pidgin accusation terms (tief, thief, ritualist,
//     etc.). Deliberately excluded ambiguous Pidgin verbs (chop, carry,
//     settle, shake) — those appear in non-defamatory sentences constantly
//     ("I chop rice", "carry your bag", "settle am"). A future pass can
//     add context-aware detection for those, but not this one.

export type DefamationResult = {
  risk: number; // 0..1
  reasons: string[];
  held: boolean; // risk >= 0.6
};

// No /i on either pattern. See file header for why.
//
// Pattern 1: honorific + one Capitalized name. Matches "Mr. John",
// "Chief Adebayo", "Dr. Ngozi", "Alhaji Musa". The honorific anchors
// the match — no /i needed because titles are always capitalized in
// written text.
//
// Pattern 2: two Capitalized names + criminal verb. Matches "John Doe
// stole", "Ngozi Okafor killed". Requires both name tokens capitalized,
// so "the man killed" does NOT match.
const NAMED_INDIVIDUAL_PATTERNS: RegExp[] = [
  /\b(?:Mr|Mrs|Ms|Miss|Dr|Chief|Alhaji|Alhaja|Pastor|Bishop|Imam|Sheikh|Senator|Hon|Honourable|Barr|Engr|Prof)\.?\s+[A-Z][a-z]+/,
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:is|stole|took|collected|demanded|raped|killed|assaulted|extorted|bribed)\b/
];

// Unambiguous criminal accusations in English + Pidgin.
// Suffix handling in countMatches covers common inflections
// (steal/steals/stealing/stealer, kill/kills/killed/killer/killers,
// murder/murdered/murderers, etc.).
const CRIMINAL_ACCUSATIONS = [
  "steal",
  "bribe",
  "extort",
  "embezzle",
  "fraud",
  "kidnap",
  "rape",
  "rapist",
  "murder",
  "kill",
  "assault",
  "cultism",
  "cultist",
  "money laundering",
  "419",
  "yahoo boy",
  "tief",
  "thief",
  "loot",
  "ritualist",
  "ritualism",
  "kidnapper",
  "robber",
  "robbery"
];

const OFFICIAL_CAPACITY_LANGUAGE = [
  "in his official capacity",
  "in her official capacity",
  "acting in his official",
  "acting in her official",
  "as the {title} of",
  "on behalf of the"
];

const TITLES_THAT_ARE_OFFICIAL = [
  "nepa",
  "police",
  "customs",
  "efcc",
  "icpc",
  "firs",
  "cbn",
  "nimc",
  "nnpc",
  "nerc",
  "disco"
];

/**
 * Count how many of `terms` appear as whole words (with optional short
 * inflections) in `text`.
 *
 * The pattern \b${term}\w{0,4}\b is deliberate:
 *   - "kill" matches kill/kills/killed/killing/killer/killers
 *   - "kill" does NOT match "skill" (no boundary before k)
 *   - "steal" does NOT match "stealership" (suffix > 4 chars)
 *   - "rape" does NOT match "grape" (no boundary before r)
 *
 * The 4-char suffix cap stops stemmed English words from slipping through
 * while still allowing "kidnapper" (kidnap + p-er = 3 chars) and
 * "murderers" (murder + e-rs = 3 chars).
 */
function countMatches(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const t of terms) {
    const escaped = t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\w{0,4}\\b`);
    if (re.test(lower)) found.push(t);
  }
  return found;
}

export function scoreDefamation(input: {
  body: string;
  agency_raw?: string | null;
  agency_canonical?: string | null;
  amount_kobo?: number | null;
  evidence_url?: string | null;
  public_link?: string | null;
}): DefamationResult {
  const reasons: string[] = [];
  let risk = 0;

  const text = input.body ?? "";
  const agency = (input.agency_canonical || input.agency_raw || "").toLowerCase();

  // Named individual present?
  let hasNamedIndividual = false;
  for (const rx of NAMED_INDIVIDUAL_PATTERNS) {
    if (rx.test(text)) {
      hasNamedIndividual = true;
      reasons.push("Names a specific individual");
      risk += 0.45;
      break;
    }
  }

  // Serious criminal accusation?
  const criminal = countMatches(text, CRIMINAL_ACCUSATIONS);
  if (criminal.length > 0) {
    risk += 0.35;
    reasons.push(`Criminal accusation: ${criminal.join(", ")}`);
  }

  // Is it in official capacity?
  const officialLanguage = OFFICIAL_CAPACITY_LANGUAGE.some((l) =>
    text.toLowerCase().includes(l)
  );
  const agencyIsKnownOfficial = TITLES_THAT_ARE_OFFICIAL.some((t) =>
    agency.includes(t)
  );
  const inOfficialCapacity = officialLanguage || agencyIsKnownOfficial;

  if (inOfficialCapacity && !hasNamedIndividual) {
    // Pure agency criticism — very low risk
    risk = Math.max(0, risk - 0.3);
  }

  // Weak evidence: no amount, no URL, no public link
  const hasAmount = (input.amount_kobo ?? 0) > 0;
  const hasEvidence = !!input.evidence_url || !!input.public_link;
  if (!hasAmount && !hasEvidence && hasNamedIndividual) {
    risk += 0.2;
    reasons.push("Named individual + no corroborating evidence");
  }

  risk = Math.max(0, Math.min(1, risk));

  return {
    risk,
    reasons,
    held: risk >= 0.6
  };
}
