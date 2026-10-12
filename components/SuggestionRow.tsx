"use client";

import Link from "next/link";
import { useState } from "react";

type SuggestionRowProps = {
  href: string;
  name: string;
  seed: string;
  meta: string;
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

export function SuggestionRow({
  href,
  name,
  seed,
  meta,
  isLast
}: SuggestionRowProps) {
  const [joined, setJoined] = useState(false);
  const tile = pickTile(seed);

  return (
    <div
      className="relative flex h-[72px] items-center gap-3 px-5"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl text-[1rem] font-bold text-white"
          style={{
            background: tile,
            fontFamily: "var(--font-space-grotesk), system-ui, sans-serif"
          }}
        >
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-semibold leading-[1.375rem] text-ink">
            {name}
          </p>
          <p className="mt-0.5 truncate text-[0.9375rem] leading-[1.25rem] text-muted">
            {meta}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setJoined(true)}
        disabled={joined}
        className={`flex h-9 min-w-[64px] shrink-0 items-center justify-center rounded-full px-4 text-[0.9375rem] font-semibold leading-[1.25rem] transition-colors ${
          joined
            ? "text-faint"
            : "bg-primary-tint text-primary-ink active:bg-primary active:text-white"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {joined ? "Joined" : "Join"}
      </button>

      {!isLast ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[84px] right-5 h-px bg-surface3"
        />
      ) : null}
    </div>
  );
}