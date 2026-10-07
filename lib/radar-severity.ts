// Corroboration gate for Radar signals.
//
// A single session can't unilaterally mark an area as "flooded" or
// "checkpoint active". We count DISTINCT sessions within a time window
// and a distance radius. Tier rises as more independent people confirm.

export const CORROBORATION_WINDOW_MINUTES = 30;
export const CORROBORATION_RADIUS_KM = 3;
export const TIER_3_THRESHOLD = 3;
export const TIER_2_THRESHOLD = 2;

export type Tier = 1 | 2 | 3;

export type SignalForCorroboration = {
  id: string;
  signal_type: string;
  session_id: string;
  lat_bucket: number;
  lng_bucket: number;
  created_at: string;
};

export type TierInfo = {
  tier: Tier;
  distinct_sessions: number;
  total_signals: number;
};

/** Approximate distance in km between two bucketed points. */
function approxKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function unbucketCoord(bucket: number): number {
  return bucket / 100;
}

/**
 * Given all signals in the area, compute the tier for a specific seed signal
 * by counting distinct sessions of the same type that confirmed within the
 * time window and radius.
 */
export function computeTierFor(
  seed: SignalForCorroboration,
  allSignals: SignalForCorroboration[]
): TierInfo {
  const seedTime = new Date(seed.created_at).getTime();
  const windowMs = CORROBORATION_WINDOW_MINUTES * 60 * 1000;
  const seedLat = unbucketCoord(seed.lat_bucket);
  const seedLng = unbucketCoord(seed.lng_bucket);

  const contributors = new Set<string>();
  let total = 0;

  for (const s of allSignals) {
    if (s.signal_type !== seed.signal_type) continue;

    const t = new Date(s.created_at).getTime();
    if (Math.abs(t - seedTime) > windowMs) continue;

    const sLat = unbucketCoord(s.lat_bucket);
    const sLng = unbucketCoord(s.lng_bucket);
    if (approxKm(seedLat, seedLng, sLat, sLng) > CORROBORATION_RADIUS_KM) {
      continue;
    }

    contributors.add(s.session_id);
    total++;
  }

  const distinct = contributors.size;
  let tier: Tier = 1;
  if (distinct >= TIER_3_THRESHOLD) tier = 3;
  else if (distinct >= TIER_2_THRESHOLD) tier = 2;

  return {
    tier,
    distinct_sessions: distinct,
    total_signals: total
  };
}

export function tierLabel(tier: Tier, distinct: number): string {
  if (tier === 1) {
    return `${distinct} person · unconfirmed`;
  }
  if (tier === 2) {
    return `${distinct} people · likely`;
  }
  return `${distinct} people · confirmed`;
}

export function tierColor(tier: Tier): {
  border: string;
  bg: string;
  text: string;
  badge: string;
} {
  if (tier === 3) {
    return {
      border: "border-danger/60",
      bg: "bg-danger-soft/60",
      text: "text-danger",
      badge: "bg-danger text-white"
    };
  }
  if (tier === 2) {
    return {
      border: "border-gold/50",
      bg: "bg-gold-soft/50",
      text: "text-warm-deep",
      badge: "bg-gold text-ink"
    };
  }
  return {
    border: "border-border",
    bg: "bg-surface",
    text: "text-muted",
    badge: "bg-ink/10 text-muted"
  };
}