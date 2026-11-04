// Reputation system (Batch 11 — schema + helpers only).
//
// Three orthogonal paths, all rooted at a dignified base tier:
//
//   Neighbour  (default, worn by everyone who joins)
//     ├── Reporter path:   Witness -> Chronicler
//     ├── Helper path:     Helper  -> Pillar
//     └── Community path:  Host    -> Anchor
//
// Rules (locked in the positioning doc):
//   * Base tier is NOT an empty slot. Neighbour is a real rank.
//   * Paths do not compete. Chronicler === Anchor in standing.
//   * Display is opt-in. Nothing is rendered unless the user toggles
//     tier_display_enabled.
//   * No numbers are ever shown to users. No leaderboards. Ever.
//   * Moderation power is NOT tied to tier — flag weight comes from
//     accuracy rate, computed quietly, never shown.
//
// THIS MODULE IS DORMANT until Batch 12. Nothing calls computeTier()
// today. It exists so that when we wire the scoring triggers, the
// thresholds are already documented in code and can be unit-tested
// without touching the app.

export type ReputationTier =
  | "neighbour"
  | "witness"
  | "chronicler"
  | "helper"
  | "pillar"
  | "host"
  | "anchor";

export type ReputationPath = "reporter" | "helper" | "community" | "base";

/**
 * The subset of a session's reputation state needed to compute their
 * tier. Every field here is backed by a column added in migration 031.
 * The `created_at` field comes from the sessions table directly
 * (already existed).
 */
export type SessionReputation = {
  created_at: string;               // sessions.created_at
  reporter_approved_count: number;
  reporter_strike_count: number;
  helper_accepted_count: number;
  community_top_space_members: number;
  community_spaces_qualified: number;
};

// Reporter path thresholds.
// Witness: 5 approved reports, 0 moderation strikes.
// Chronicler: 25 approved, accuracy implied by 0 strikes, 6 months old.
const WITNESS_MIN_APPROVED = 5;
const CHRONICLER_MIN_APPROVED = 25;
const CHRONICLER_MIN_MONTHS = 6;

// Helper path thresholds.
// Helper: 10 accepted answers.
// Pillar: 50 accepted answers, 6 months old.
const HELPER_MIN_ACCEPTED = 10;
const PILLAR_MIN_ACCEPTED = 50;
const PILLAR_MIN_MONTHS = 6;

// Community path thresholds.
// Host: at least one space reached 50 members.
// Anchor: 3 spaces reached 100 members, OR 1 space reached 500.
const HOST_MIN_MEMBERS = 50;
const ANCHOR_MIN_SPACES = 3;
const ANCHOR_MIN_MEMBERS_PER_SPACE = 100;
const ANCHOR_HERO_MIN_MEMBERS = 500;

function monthsOld(isoDate: string): number {
  const created = new Date(isoDate).getTime();
  if (Number.isNaN(created)) return 0;
  return (Date.now() - created) / (1000 * 60 * 60 * 24 * 30.4375);
}

export function computeReporterTier(r: SessionReputation): ReputationTier {
  const { reporter_approved_count, reporter_strike_count } = r;
  if (reporter_strike_count > 0) return "neighbour";
  if (
    reporter_approved_count >= CHRONICLER_MIN_APPROVED &&
    monthsOld(r.created_at) >= CHRONICLER_MIN_MONTHS
  ) {
    return "chronicler";
  }
  if (reporter_approved_count >= WITNESS_MIN_APPROVED) return "witness";
  return "neighbour";
}

export function computeHelperTier(r: SessionReputation): ReputationTier {
  const { helper_accepted_count } = r;
  if (
    helper_accepted_count >= PILLAR_MIN_ACCEPTED &&
    monthsOld(r.created_at) >= PILLAR_MIN_MONTHS
  ) {
    return "pillar";
  }
  if (helper_accepted_count >= HELPER_MIN_ACCEPTED) return "helper";
  return "neighbour";
}

export function computeCommunityTier(r: SessionReputation): ReputationTier {
  const { community_top_space_members, community_spaces_qualified } = r;
  if (
    community_top_space_members >= ANCHOR_HERO_MIN_MEMBERS ||
    (community_spaces_qualified >= ANCHOR_MIN_SPACES &&
      community_top_space_members >= ANCHOR_MIN_MEMBERS_PER_SPACE)
  ) {
    return "anchor";
  }
  if (community_top_space_members >= HOST_MIN_MEMBERS) return "host";
  return "neighbour";
}

/**
 * Compute the HIGHEST tier a session has earned across all three
 * paths. "Highest" here means: whichever path they've advanced on,
 * their displayed tier is that path's level. Because paths do not
 * compete, if a user is both a Witness and a Helper, we display
 * whichever one they advanced further on. Ties resolve in path order
 * (reporter, then helper, then community) — arbitrary but stable.
 */
export function computeTier(r: SessionReputation): ReputationTier {
  const candidates: ReputationTier[] = [
    computeReporterTier(r),
    computeHelperTier(r),
    computeCommunityTier(r)
  ];
  const rank: Record<ReputationTier, number> = {
    neighbour: 0,
    witness: 1,
    helper: 1,
    host: 1,
    chronicler: 2,
    pillar: 2,
    anchor: 2
  };
  return candidates.reduce((a, b) => (rank[b] > rank[a] ? b : a));
}

/**
 * Human-readable label for the tier. Use this when rendering badges
 * (Batch 12+). Never render the underlying numbers or rank.
 */
export function tierLabel(tier: ReputationTier): string {
  switch (tier) {
    case "neighbour": return "Neighbour";
    case "witness": return "Witness";
    case "chronicler": return "Chronicler";
    case "helper": return "Helper";
    case "pillar": return "Pillar";
    case "host": return "Host";
    case "anchor": return "Anchor";
  }
}

/**
 * Which path does this tier belong to? Used by the future badge
 * renderer to pick the right colour.
 */
export function tierPath(tier: ReputationTier): ReputationPath {
  switch (tier) {
    case "neighbour": return "base";
    case "witness":
    case "chronicler": return "reporter";
    case "helper":
    case "pillar": return "helper";
    case "host":
    case "anchor": return "community";
  }
}
