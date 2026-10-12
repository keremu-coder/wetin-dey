"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type SuggestionRowProps = {
  href: string;
  name: string;
  seed: string;
  emoji?: string | null;
  meta: string;
  isLast?: boolean;
};

const TILES = [
  "var(--color-leaf)",
  "var(--color-adire)",
  "var(--color-zobo)",
  "var(--color-clay)",
  "var(--color-plum)",
  "var(--color-lagoon)"
];

function pickTile(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TILES[Math.abs(h) % TILES.length];
}

function initials(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function SuggestionRow({ href, name, seed, emoji, meta, isLast }: SuggestionRowProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "joined">("idle");
  const slug = href.replace(/^\/c\//, "").split("/")[0];
  const tile = pickTile(seed);
  const glyph = emoji ? emoji : initials(name);

  async function join() {
    if (state !== "idle") return;
    setState("busy");
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join" })
      });
      if (res.ok) {
        setState("joined");
        router.refresh();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(j.error ?? "Could not join. Try again.");
    } catch {
      window.alert("Network error. Check your connection and try again.");
    }
    setState("idle");
  }

  return (
    <div className="relative flex h-[76px] items-center gap-3.5 px-5" style={{ WebkitTapHighlightColor: "transparent" }}>
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3.5">
        <div
          className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full text-white shadow-sm"
          style={{
            background: tile,
            fontFamily: emoji ? undefined : "var(--font-space-grotesk), system-ui, sans-serif",
            fontSize: emoji ? 26 : 16,
            fontWeight: emoji ? undefined : 700
          }}
        >
          {glyph}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-bold leading-[1.375rem] text-ink">{name}</p>
          <p className="mt-1 truncate text-[0.9375rem] leading-[1.25rem] text-muted">{meta}</p>
        </div>
      </Link>

      <button
        type="button"
        onClick={join}
        disabled={state !== "idle"}
        className={`flex h-9 min-w-[64px] shrink-0 items-center justify-center rounded-full px-4 text-[0.9375rem] font-semibold leading-[1.25rem] transition-colors ${
          state === "joined" ? "text-faint" : "bg-primary-tint text-primary-ink active:bg-primary active:text-white"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {state === "joined" ? "Joined" : state === "busy" ? "Joining" : "Join"}
      </button>

      {!isLast ? (
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-[86px] right-5 h-px bg-surface3" />
      ) : null}
    </div>
  );
}