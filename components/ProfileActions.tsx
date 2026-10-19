"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { FlagSheet } from "./FlagSheet";

export function ProfileActions({
  profileId,
  handle
}: {
  profileId: string;
  handle: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function blockUser() {
    if (busy) return;
    if (!confirm(`Block @${handle}? You won't see their posts or messages.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, action: "block" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(data.error ?? "Could not block. Try again.", "error");
        setBusy(false);
        return;
      }
      setMenuOpen(false);
      router.refresh();
    } catch {
      toast.show("Could not block. Check your connection.", "error");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-surface text-faint transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label="More options"
        >
          {"\u2022\u2022\u2022"}
        </button>

        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 animate-fade-in"
              onClick={() => setMenuOpen(false)}
            />
            <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up rounded-t-3xl border-t border-border bg-surface pb-8 pt-2 shadow-2xl">
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-ink/20" />
              <div className="flex flex-col px-4">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setFlagOpen(true);
                  }}
                  className="flex h-14 w-full items-center justify-center rounded-xl text-[1.05rem] font-semibold text-ink hover:bg-ink/5 active:bg-ink/10"
                >
                  Report @{handle}
                </button>
                <div className="my-1 h-px w-full bg-border" />
                <button
                  type="button"
                  onClick={blockUser}
                  disabled={busy}
                  className="flex h-14 w-full items-center justify-center rounded-xl text-[1.05rem] font-semibold text-danger hover:bg-danger-soft active:bg-danger-soft disabled:opacity-60"
                >
                  {busy ? "Dey block…" : `Block @${handle}`}
                </button>
                <div className="my-1 h-px w-full bg-border" />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-14 w-full items-center justify-center rounded-xl text-[1.05rem] font-semibold text-muted hover:bg-ink/5 active:bg-ink/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {flagOpen ? (
        <FlagSheet
          targetType="user"
          targetId={profileId}
          targetLabel={`@${handle}`}
          onClose={() => setFlagOpen(false)}
        />
      ) : null}
    </>
  );
}
