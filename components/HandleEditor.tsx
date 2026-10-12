"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { unlockAudio, vibrate } from "@/lib/sounds";
import { validateHandle, HANDLE_MIN, HANDLE_MAX } from "@/lib/handle-rules";

type Loaded = {
  handle: string;
  previous_handles: string[];
  handle_changed_at: string | null;
  cooldown_days_left: number;
};

export function HandleEditor({ initialHandle }: { initialHandle: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState(initialHandle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/handle", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.handle) return;
        setLoaded(d as Loaded);
        setDraft(d.handle);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  const cooldown = loaded.cooldown_days_left;
  const locked = cooldown > 0;
  const check = validateHandle(draft);
  const unchanged = draft.trim().toLowerCase() === loaded.handle;
  const canSubmit = check.ok && !unchanged && !busy && !locked;

  async function submit() {
    if (!canSubmit) return;
    unlockAudio();
    setBusy(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/settings/handle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: draft })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        return;
      }
      setSaved(true);
      vibrate(25);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] text-faint">
            Handle
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Your public username. Letters, numbers, and underscores.
          </p>
        </div>
        <span className="shrink-0 text-[1.25rem]">@</span>
      </div>

      <div className="relative mt-4">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[1rem] text-faint">
          @
        </span>
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.toLowerCase().slice(0, HANDLE_MAX));
            setError("");
            setSaved(false);
          }}
          disabled={busy || locked}
          placeholder="your_name"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={HANDLE_MAX}
          className="!pl-8 !!text-[0.9375rem]"
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <p
          className={`text-[0.7rem] ${
            draft.length > 0 && !check.ok
              ? "text-danger"
              : "text-faint"
          }`}
        >
          {draft.length === 0
            ? `Minimum ${HANDLE_MIN} characters.`
            : check.ok
              ? "Looks good."
              : check.reason}
        </p>
        <p className="text-[0.65rem] text-faint">
          {draft.length}/{HANDLE_MAX}
        </p>
      </div>

      {locked ? (
        <div className="mt-3 rounded-xl bg-gold-soft/50 p-3">
          <p className="text-[0.75rem] leading-relaxed text-ink">
            <strong>Handle locked.</strong> You can change it again in{" "}
            <strong>
              {cooldown} day{cooldown === 1 ? "" : "s"}
            </strong>
            . This prevents impersonation.
          </p>
        </div>
      ) : null}

      {loaded.previous_handles.length > 0 ? (
        <div className="mt-3 rounded-xl bg-ink/5 p-3">
          <p className="text-[0.7rem] font-semibold text-ink">
            Previous handles
          </p>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
            Old links still redirect to your profile:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {loaded.previous_handles.map((h) => (
              <span
                key={h}
                className="rounded-full bg-paper px-2 py-0.5 text-[0.7rem] text-muted"
              >
                @{h}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="mt-3 rounded-xl bg-brand-tint px-3 py-2 text-[0.8125rem] font-medium text-brand">
          ✓ Handle updated to @{loaded.handle}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 w-full rounded-xl bg-brand py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-40"
      >
        {busy
          ? "Saving…"
          : unchanged
            ? "That's already your handle"
            : locked
              ? `Locked for ${cooldown} day${cooldown === 1 ? "" : "s"}`
              : "Save new handle"}
      </button>
    </div>
  );
}