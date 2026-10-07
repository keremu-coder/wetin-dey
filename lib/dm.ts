// DM helpers.

/** Alphabetically smaller id first. Keeps UNIQUE(session_a, session_b) reliable. */
export function orderParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** The other participant in a thread, given my session id. */
export function otherParticipant(
  thread: { session_a: string; session_b: string },
  me: string
): string {
  return thread.session_a === me ? thread.session_b : thread.session_a;
}

export const DM_BODY_MAX = 500;

export function timeAgoShort(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric"
  });
}