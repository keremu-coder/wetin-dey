// Presence helpers.
//
// Rule (from DECISIONS.md):
//   last_seen < 2 min  → online  (green)
//   last_seen < 15 min → away    (gold)
//   anything older     → offline (grey)

export type PresenceState = "online" | "away" | "offline";

export function presenceFromLastSeen(
  lastSeenAt: string | null | undefined
): PresenceState {
  if (!lastSeenAt) return "offline";
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return "offline";
  const diff = Date.now() - t;
  if (diff < 2 * 60 * 1000) return "online";
  if (diff < 15 * 60 * 1000) return "away";
  return "offline";
}

export function PresenceDot({
  state,
  size = "sm"
}: {
  state: PresenceState;
  size?: "sm" | "md";
}) {
  const px = size === "md" ? 12 : 10;
  const bg =
    state === "online"
      ? "#22c55e"
      : state === "away"
        ? "#e0a349"
        : "#8b98a5";

  return (
    <span
      className="inline-block rounded-full ring-2 ring-paper"
      style={{
        width: px,
        height: px,
        background: bg
      }}
      aria-label={state}
    />
  );
}