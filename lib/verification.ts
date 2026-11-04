// lib/verification.ts
// Scores evidence quality and detects high-risk patterns.

export type VerificationInput = {
  evidenceType: string | null;
  evidenceLink: string | null;
  body: string;
  agencyRaw: string;
  sessionPostCount: number; // how many posts this session has made
};

export type VerificationResult = {
  tier: "strong" | "medium" | "weak" | "unverified";
  targetType: "public_agency" | "public_official" | "private_individual" | "unknown";
  sourceDomain: string | null;
  requiresManualReview: boolean;
  reason: string;
};

// Known trusted news/court domains
const TRUSTED_DOMAINS = [
  "premiumtimesng.com",
  "punchng.com",
  "thecable.ng",
  "saharareporters.com",
  "vanguardngr.com",
  "guardian.ng",
  "thisdaylive.com",
  "businessday.ng",
  "leadership.ng",
  "channelstv.com",
  "serap.org",
  "budgit.org",
  "nigeria.gov.ng",
  "nerc.gov.ng",
  "efcc.gov.ng",
  "icpc.gov.ng",
  "nass.gov.ng",
  "nigerialii.org",
  "lawpavilion.com"
];

// Words that signal the target is a private individual, not an agency
const PRIVATE_TARGET_PATTERNS = [
  /\bmy (neighbour|neighbor|landlord|landlady|boss|colleague|coworker)\b/i,
  /\b(mr|mrs|miss|dr|prof)\.?\s+[a-z]+\s+[a-z]+/i,
  /\b(him|her) name is\b/i,
  /\bthis (man|woman|person|guy|girl|boy)\b/i
];

export function scoreEvidence(input: VerificationInput): VerificationResult {
  let tier: VerificationResult["tier"] = "unverified";
  let targetType: VerificationResult["targetType"] = "public_agency";
  let sourceDomain: string | null = null;
  let requiresManualReview = false;
  let reason = "";

  // Detect target type
  for (const p of PRIVATE_TARGET_PATTERNS) {
    if (p.test(input.body)) {
      targetType = "private_individual";
      requiresManualReview = true;
      reason = "Mentions a private individual — held for review";
      break;
    }
  }

  // Evidence scoring
  if (input.evidenceType === "photo" || input.evidenceType === "video") {
    tier = "strong";
  } else if (input.evidenceType === "audio") {
    tier = "medium";
  } else if (input.evidenceType === "voice_testimony") {
    tier = "weak";
  } else if (input.evidenceType === "public_link" && input.evidenceLink) {
    try {
      const url = new URL(input.evidenceLink);
      sourceDomain = url.hostname.replace(/^www\./, "");

      const isTrusted = TRUSTED_DOMAINS.some(
        (d) => sourceDomain === d || sourceDomain?.endsWith("." + d)
      );

      if (isTrusted) {
        tier = "strong";
      } else {
        tier = "weak";
        reason = "Link from an unrecognized source";
      }
    } catch {
      tier = "unverified";
      reason = "Could not verify link";
    }
  }

  // New accounts (fewer than 2 posts) hitting high-risk patterns → manual review
  if (input.sessionPostCount < 2 && targetType === "private_individual") {
    requiresManualReview = true;
    reason = "New account accusing a private individual";
  }

  return { tier, targetType, sourceDomain, requiresManualReview, reason };
}

export function tierLabel(tier: string): string {
  switch (tier) {
    case "strong":
      return "Verified evidence attached";
    case "medium":
      return "Recorded evidence attached";
    case "weak":
      return "First-person testimony only";
    default:
      return "Unverified — pending review";
  }
}