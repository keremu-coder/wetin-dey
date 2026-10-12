"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type SuggestionRowProps = {
  href: string;
  name: string;
  meta: string;
  isLast?: boolean;
};

function initials(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function SuggestionRow({ href, name, meta, isLast }: SuggestionRowProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "joined">("idle");
  const slug = href.replace(/^\/c\//, "").split("/")[0];

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
    <div className="relative flex h-[68px] items-center gap-3.5 px-5" style={{ WebkitTapHighlightColor: "transparent" }}>
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3.5">
        <div
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-[0.9375rem] font-semibold text-primary-ink"
          style={{ fontFamily: "var(--font-space-grotesk), system-ui, sans-serif" }}
        >
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-semibold leading-[1.375rem] text-ink">{name}</p>
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
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-[82px] right-5 h-px bg-surface3" />
      ) : null}
    </div>
  );
}