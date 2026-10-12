"use client";

import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";

export function InviteSheet({
  slug,
  name,
  emoji,
  onClose
}: {
  slug: string;
  name: string;
  emoji: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://9jawatindey.vercel.app";
    setUrl(`${base}/c/${slug}`);
  }, [slug]);

  const shareText = `Join ${emoji} ${name} on Wetin Dey — a Nigerian community space`;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator && url) {
      try {
        await (
          navigator as Navigator & { share: (d: ShareData) => Promise<void> }
        ).share({ title: name, text: shareText, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    copy();
  }

  function whatsapp() {
    if (!url) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`,
      "_blank"
    );
  }

  function twitter() {
    if (!url) return;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="font-serif text-xl font-semibold text-ink">
        Invite to {emoji} {name}
      </h2>
      <p className="mt-1 text-[0.875rem] text-muted">
        Anyone with this link can join this space.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-paper px-3 py-2.5">
        <span className="flex-1 truncate font-mono text-[0.75rem] text-ink">
          {url || "Loading…"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-brand-soft"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={whatsapp}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-paper p-3 transition-colors hover:border-brand"
        >
          <span className="text-2xl">💬</span>
          <span className="text-[0.7rem] font-medium text-ink">
            WhatsApp
          </span>
        </button>
        <button
          type="button"
          onClick={twitter}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-paper p-3 transition-colors hover:border-brand"
        >
          <span className="text-2xl">𝕏</span>
          <span className="text-[0.7rem] font-medium text-ink">
            Twitter / X
          </span>
        </button>
        <button
          type="button"
          onClick={nativeShare}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-paper p-3 transition-colors hover:border-brand"
        >
          <span className="text-2xl">📤</span>
          <span className="text-[0.7rem] font-medium text-ink">More</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-xl border border-border bg-paper py-2.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5"
      >
        Cancel
      </button>
    </Sheet>
  );
}