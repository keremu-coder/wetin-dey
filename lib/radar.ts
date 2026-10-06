// Live Radar signal registry.
// Six signals. Colours: positive (accent), warning (gold), negative (danger).

export type SignalId =
  | "grid_up"
  | "blackout"
  | "checkpoint"
  | "flood"
  | "fuel_queue"
  | "road_clear";

export type Signal = {
  id: SignalId;
  emoji: string;
  label: string;
  hint: string;
  tone: "positive" | "warning" | "negative";
};

export const SIGNALS: Signal[] = [
  {
    id: "grid_up",
    emoji: "💡",
    label: "NEPA dey",
    hint: "Grid up in your area",
    tone: "positive"
  },
  {
    id: "blackout",
    emoji: "🔌",
    label: "Blackout",
    hint: "No light right now",
    tone: "negative"
  },
  {
    id: "checkpoint",
    emoji: "🚨",
    label: "Checkpoint",
    hint: "Police or boys dey collect",
    tone: "negative"
  },
  {
    id: "flood",
    emoji: "🌊",
    label: "Flood",
    hint: "Road don flood",
    tone: "warning"
  },
  {
    id: "fuel_queue",
    emoji: "🛢️",
    label: "Fuel queue",
    hint: "Long line at the station",
    tone: "warning"
  },
  {
    id: "road_clear",
    emoji: "✅",
    label: "Road clear",
    hint: "Free movement on your route",
    tone: "positive"
  }
];

const SIGNAL_MAP: Record<string, Signal> = Object.fromEntries(
  SIGNALS.map((s) => [s.id, s])
);

export function getSignal(id: string): Signal | null {
  return SIGNAL_MAP[id] ?? null;
}

export function isValidSignalId(id: unknown): id is SignalId {
  return typeof id === "string" && id in SIGNAL_MAP;
}

/**
 * Round a coordinate to ~1 km precision (~0.01 deg).
 * Stores as an integer (smallint) so the DB is compact.
 */
export function bucketCoord(value: number): number {
  return Math.round(value * 100);
}

export function unbucketCoord(bucket: number): number {
  return bucket / 100;
}

/**
 * Approximate distance in km between two bucketed points.
 */
export function approxKm(
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

/**
 * Human-friendly age. "just now", "3m", "45m", "2h"
 */
export function signalAge(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}