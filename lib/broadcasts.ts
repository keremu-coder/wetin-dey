// Broadcast voice notes — BBM-Broadcast mechanic, one voice note to a
// whole Space. Only owners/admins can send. Everyone hears it.

export const BROADCAST_MAX_SECONDS = 60;
export const BROADCAST_MAX_MB = 8;
export const BROADCAST_TTL_HOURS = 24;

export const BROADCAST_TITLE_MAX = 60;

export function isBroadcastExpired(expiresAt: string | Date): boolean {
  const t =
    typeof expiresAt === "string"
      ? new Date(expiresAt).getTime()
      : expiresAt.getTime();
  return Date.now() > t;
}

export function broadcastAge(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function broadcastExpiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h left`;
}