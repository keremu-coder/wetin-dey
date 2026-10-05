export type PresenceState = "online" | "away" | "offline";

export function presenceFromLastSeen(lastSeen: string | null): PresenceState {
  if (!lastSeen) return "offline";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const mins = diff / 60000;
  if (mins < 2) return "online";
  if (mins < 15) return "away";
  return "offline";
}

export function PresenceDot({
  state,
  size = "sm"
}: {
  state: PresenceState;
  size?: "sm" | "md";
}) {
  const color =
    state === "online"
      ? "bg-accent"
      : state === "away"
      ? "bg-warm"
      : "bg-faint";

  const dim = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span
      className={`inline-block ${dim} rounded-full ${color} ring-2 ring-paper`}
      aria-label={state}
      title={state}
    />
  );
}