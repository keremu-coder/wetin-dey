// lib/chat.ts
// Shared types and helpers for the community chat rooms.

export type Reaction = { emoji: string; count: number };

export type Message = {
  id: string;
  body: string | null;
  audio_url: string | null;
  created_at: string;
  author_handle: string;
  author_last_seen: string | null;
  reactions: Reaction[];
  _cid?: string;
  _pending?: boolean;
  _failed?: boolean;
};

export type Member = {
  session_id: string;
  handle: string;
  last_seen_at: string | null;
  role: string;
};

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const colors = [
    "#C0392B",
    "#D97706",
    "#1F7A4D",
    "#7C3AED",
    "#0E7490",
    "#BE185D",
    "#4D7C0F",
    "#A16207"
  ];
  return colors[Math.abs(h) % colors.length];
}

export function containsMentionOf(text: string, handle: string): boolean {
  if (!text || !handle) return false;
  const pattern = new RegExp(
    `@${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i"
  );
  return pattern.test(text);
}

export function timeShort(date: string): string {
  return new Date(date).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit"
  });
}

export function timeWithDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return `Today at ${timeShort(date)}`;
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday at ${timeShort(date)}`;
  return (
    d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }) +
    " at " +
    timeShort(date)
  );
}

export function dayLabel(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NG", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

export function makeCid(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}