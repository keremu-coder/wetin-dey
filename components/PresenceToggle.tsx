"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unlockAudio, vibrate } from "@/lib/sounds";

export function PresenceToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function toggle() {
    if (busy) return;
    unlockAudio();
    setBusy(true);
    setError("");
    const next = !on;
    setOn(next);

    try {
      const res = await fetch("/api/settings/hide-presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hide_presence: next })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        setOn(!next);
        return;
      }
      vibrate(20);
      setSavedAt(Date.now());
      router.refresh();
    } catch {
      setError("Network error");
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold text-ink">
            Hide my presence
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            {on
              ? "Your online dot is hidden. You also can't see anyone else's dots."
              : "You appear online, away, or offline like normal. And you can see everyone else's dots."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={on}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-brand" : "bg-ink/10"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-[1.375rem]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {savedAt ? (
        <p className="mt-3 text-[0.75rem] font-medium text-brand">
          ✓ Saved
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}