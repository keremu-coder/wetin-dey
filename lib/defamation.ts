// Heuristic defamation risk scorer.
//
// Applied to every report BEFORE it goes to the AI formalization step.
// Combined with the AI's own defamation flag, this gives us defense-in-depth:
// if either layer scores high, the report is held for manual review.
//
// This is a heuristic, not a legal opinion. It catches the obvious patterns.
// The AI catches the subtle ones. A human moderator catches the rest.

export type DefamationResult = {
  risk: number; // 0..1
  reasons: string[];
  held: boolean; // risk >= 0.6
};

const NAMED_INDIVIDUAL_PATTERNS: RegExp[] = [
  /\b(Mr|Mrs|Ms|Miss|Dr|Chief|Alhaji|Alhaja|Pastor|Bishop|Imam|Sheikh|Senator|Hon|Honourable|Barr|Engr|Prof)\.?\s+[A-Z][a-z]+/i,
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(is|stole|took|collected|demanded|raped|killed|assaulted|extorted|bribed)/i
];

const CRIMINAL_ACCUSATIONS = [
  "stole",
  "steal",
  "bribe",
  "bribery",
  "extort",
  "extortion",
  "embezzle",
  "embezzlement",
  "fraud",
  "fraudulent",
  "kidnap",
  "kidnapped",
  "rape",
  "raped",
  "murder",
  "murdered",
  "kill",
  "killed",
  "assault",
  "assaulted",
  "cultist",
  "cultism",
  "money laundering",
  "419",
  "yahoo boy"
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
  "disco",
  "disco"
];

function countMatches(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const t of terms) {
    if (lower.includes(t.toLowerCase())) found.push(t);
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