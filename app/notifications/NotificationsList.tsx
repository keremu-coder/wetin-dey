"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveRefreshNotifications } from "@/components/LiveStateProvider";

export type NotificationItem = {
  id: string;
  actor_id: string | null;
  kind: string;
  target_type: string;
  target_id: string;
  preview: string | null;
  created_at: string;
  read_at: string | null;
  actor_handle: string | null;
  target_slug: string | null;
};

function kindLabel(kind: string): string {
  if (kind === "reply") return "replied to your message";
  if (kind === "mention") return "mentioned you";
  if (kind === "comment") return "commented on your report";
  return "sent you a notification";
}

function kindIcon(kind: string): string {
  if (kind === "reply") return "↩";
  if (kind === "mention") return "@";
  if (kind === "comment") return "💬";
  return "🔔";
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Lagos"
  });
}

/**
 * Client list for the notifications page.
 *
 * - On mount: POST /api/notifications/read { all: true } to clear the
 *   badge, then call refreshNotifications() so the count updates now
 *   instead of waiting for the next 30s poll.
 * - Tap a row: navigate. report -> /r/[id]. community_message -> the
 *   space chat via the community slug resolved server-side. If the slug
 *   is missing (message deleted, community gone), fall back to /inbox.
 * - Rows already read at load are still rendered (faded), so a user
 *   opening the page twice does not lose context.
 */
export function NotificationsList({
  initialItems
}: {
  initialItems: NotificationItem[];
}) {
  const router = useRouter();
  const refreshNotifications = useLiveRefreshNotifications();
  const [items, setItems] = useState<NotificationItem[]>(initialItems);

  useEffect(() => {
    if (items.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ all: true })
        });
        if (cancelled) return;

        refreshNotifications();

        const now = new Date().toISOString();
        setItems((prev) =>
          prev.map((r) => (r.read_at ? r : { ...r, read_at: now }))
        );
      } catch {
        /* silent — badge stays until next poll */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hrefFor(item: NotificationItem): string {
    if (item.target_type === "report") {
      return `/r/${item.target_id}`;
    }
    if (item.target_type === "community_message") {
      if (item.target_slug) {
        return `/c/${item.target_slug}/chat`;
      }
      return "/inbox";
    }
    return "/";
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <div className="text-[2.5rem]">🔔</div>
        <p className="mt-3 font-serif text-[1.15rem] font-semibold text-ink">
          No notifications yet
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
          When someone replies to you, mentions you, or comments on your
          report, it will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((item, i) => {
        const unread = !item.read_at;
        const handle = item.actor_handle;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(hrefFor(item))}
            className={`flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-ink/5 ${
              i !== 0 ? "border-t border-border" : ""
            } ${unread ? "bg-brand/[0.04]" : ""}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[1rem] ${
                unread
                  ? "bg-brand text-white"
                  : "bg-ink/5 text-muted"
              }`}
              aria-hidden
            >
              {kindIcon(item.kind)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] leading-snug text-ink">
                {handle ? (
                  <span className="font-semibold">@{handle}</span>
                ) : (
                  <span className="font-semibold text-muted">Someone</span>
                )}{" "}
                <span className="text-muted">{kindLabel(item.kind)}</span>
              </p>
              {item.preview ? (
                <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-muted">
                  {item.preview}
                </p>
              ) : null}
            </div>

            <span className="shrink-0 font-mono text-[0.65rem] text-faint">
              {timeAgo(item.created_at)}
            </span>

            {unread ? (
              <span
                className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}