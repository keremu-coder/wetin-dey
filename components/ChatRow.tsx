"use client";

import Link from "next/link";

type ChatRowProps = {
  href: string;
  name: string;
  seed: string;
  avatarUrl?: string | null;
  isPerson?: boolean;
  presence?: boolean;
  preview: string;
  previewPrefix?: string;
  previewLive?: boolean;
  timestamp: string;
  unread?: number;
  muted?: boolean;
  isLast?: boolean;
};

const TILE_COLORS = [
  "#0A6B43",
  "#2B4A9E",
  "#A3203A",
  "#A8501F",
  "#6A2E73",
  "#0F6A73"
];

function pickTile(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TILE_COLORS[Math.abs(h) % TILE_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ChatRow({
  href,
  name,
  seed,
  avatarUrl,
  isPerson,
  presence,
  preview,
  previewPrefix,
  previewLive,
  timestamp,
  unread = 0,
  muted,
  isLast
}: ChatRowProps) {
  const tile = pickTile(seed);
  const hasUnread = unread > 0 && !muted;
  const isMutedUnread = unread > 0 && muted;

  return (
    <Link
      href={href}
      className="group relative flex h-[72px] items-center gap-3 px-5 transition-colors active:bg-surface2"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="relative shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className={`h-[52px] w-[52px] object-cover ${isPerson ? "rounded-full" : "rounded-2xl"}`}
          />
        ) : (
          <div
            className={`flex h-[52px] w-[52px] items-center justify-center text-[1rem] font-bold text-white ${isPerson ? "rounded-full" : "rounded-2xl"}`}
            style={{
              background: tile,
              fontFamily: "var(--font-space-grotesk), system-ui, sans-serif"
            }}
          >
            {initials(name)}
          </div>
        )}
        {isPerson && presence ? (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-paper"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold leading-[1.375rem] text-ink">
            {name}
          </p>
          <span
            className={`shrink-0 text-[0.8125rem] font-medium leading-[1.125rem] ${hasUnread ? "text-primary-ink" : "text-faint"}`}
          >
            {timestamp}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={`min-w-0 flex-1 truncate text-[0.9375rem] leading-[1.25rem] ${
              previewLive
                ? "text-primary-ink font-medium"
                : hasUnread
                  ? "text-ink font-medium"
                  : "text-muted"
            }`}
          >
            {previewPrefix ? (
              <span className="text-muted">{previewPrefix}</span>
            ) : null}
            {preview}
          </p>
          {hasUnread || isMutedUnread ? (
            <span
              className={`flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1.5 text-[0.75rem] font-semibold leading-none ${
                hasUnread
                  ? "bg-primary text-white"
                  : "bg-surface3 text-muted"
              }`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
      </div>

      {!isLast ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[84px] right-5 h-px bg-surface3 transition-opacity group-active:opacity-0"
        />
      ) : null}
    </Link>
  );
}