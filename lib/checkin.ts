// Private check-in system. Scoped to a Space. Not public.
// The co-builder's "family safety check" concept, shippable.

export const CHECKIN_MAX_NOTE = 120;
export const CHECKIN_WINDOW_HOURS = 48;
export const CHECKIN_REASON_MAX = 80;

export type CheckinStatus = "safe" | "ok" | "help";

export function isValidCheckinStatus(s: unknown): s is CheckinStatus {
  return s === "safe" || s === "ok" || s === "help";
}

export function statusLabel(s: CheckinStatus): string {
  if (s === "safe") return "I'm safe";
  if (s === "help") return "I need help";
  return "I'm ok";
}

export function statusEmoji(s: CheckinStatus): string {
  if (s === "safe") return "✅";
  if (s === "help") return "🆘";
  return "👌";
}

export function checkinAge(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function checkinExpiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h left`;
}