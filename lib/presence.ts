// BBM-style presence. Two inputs:
//   1. availability — a manual override the user picked (green/red/etc.)
//   2. last_seen_at — how recently they pinged (fallback when availability=auto)
//
// Result is a single presence state with a color, a label, and a rank so we
// can sort "available first" like BBM did.

export type AvailabilityId =
  | "auto"
  | "available"
  | "busy"
  | "away"
  | "meeting"
  | "driving"
  | "sleeping";

export type PresenceState =
  | "available"
  | "busy"
  | "away"
  | "meeting"
  | "driving"
  | "sleeping"
  | "offline";

export type PresenceDef = {
  id: PresenceState;
  label: string;
  color: string;      // hex for dot
  rank: number;       // 0 = top of list
};

export const PRESENCE_DEFS: Record<PresenceState, PresenceDef> = {
  available: { id: "available", label: "Available", color: "#10b981", rank: 0 },
  meeting: { id: "meeting", label: "In a meeting", color: "#f59e0b", rank: 1 },
  driving: { id: "driving", label: "Driving", color: "#3b82f6", rank: 2 },
  busy: { id: "busy", label: "Busy", color: "#ef4444", rank: 3 },
  away: { id: "away", label: "Away", color: "#eab308", rank: 4 },
  sleeping: { id: "sleeping", label: "Sleeping", color: "#a855f7", rank: 5 },
  offline: { id: "offline", label: "Offline", color: "#71717a", rank: 6 }
};

/** Choices shown in the availability picker. */
export const AVAILABILITY_CHOICES: Array<{
  id: AvailabilityId;
  label: string;
  hint: string;
}> = [
  { id: "auto", label: "Auto", hint: "Based on your activity" },
  { id: "available", label: "Available", hint: "Free to chat" },
  { id: "busy", label: "Busy", hint: "Do not disturb" },
  { id: "away", label: "Away", hint: "Not around right now" },
  { id: "meeting", label: "In a meeting", hint: "Back shortly" },
  { id: "driving", label: "Driving", hint: "On the road" },
  { id: "sleeping", label: "Sleeping", hint: "Resting — will reply later" }
];

export function isValidAvailability(a: unknown): a is AvailabilityId {
  return (
    a === "auto" ||
    a === "available" ||
    a === "busy" ||
    a === "away" ||
    a === "meeting" ||
    a === "driving" ||
    a === "sleeping"
  );
}

/**
 * Compute the effective presence from manual availability + last_seen_at.
 * Rules:
 *   - If availability is set (not 'auto'), that wins.
 *   - If 'auto' or missing: <2 min = available, <15 min = away, else offline.
 */
export function computePresence(
  availability: string | null | undefined,
  lastSeenAt: string | null | undefined
): PresenceState {
  const a = (availability ?? "auto").toLowerCase();
  if (a === "available" || a === "busy" || a === "away") return a;
  if (a === "meeting" || a === "driving" || a === "sleeping") return a;

  if (!lastSeenAt) return "offline";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 2 * 60 * 1000) return "available";
  if (diff < 15 * 60 * 1000) return "away";
  return "offline";
}

export function presenceDef(state: PresenceState): PresenceDef {
  return PRESENCE_DEFS[state];
}

/**
 * Format for a BBM-style secondary line: "Available - Life is a party"
 * If there's no status, just shows the availability label.
 */
export function presenceLine(
  state: PresenceState,
  statusLine: string | null | undefined
): string {
  const label = presenceDef(state).label;
  if (statusLine && statusLine.trim()) {
    return `${label} - ${statusLine.trim()}`;
  }
  return label;
}

/** A tiny "last seen" hint under the presence line, like BBM's timestamp. */
export function lastSeenHint(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(lastSeenAt).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric"
  });
}