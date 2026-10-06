"use client";

import { useState } from "react";

const REASONS: { id: string; label: string; hint: string }[] = [
  { id: "spam", label: "Spam", hint: "Ads, repeated posts" },
  { id: "harassment", label: "Harassment", hint: "Abuse, threats, bullying" },
  { id: "hate", label: "Hate speech", hint: "Tribal, religious, or group attacks" },
  { id: "misinformation", label: "False info", hint: "Knowingly false claims" },
  { id: "scam", label: "Scam", hint: "Fraud, fake offers" },
  { id: "other", label: "Something else", hint: "Tell us more" }
];

export function FlagSheet({
  targetType,
  targetId,
  targetLabel,
  onClose
}: {
  targetType: "message" | "community" | "comment";
  targetId: string;
  targetLabel: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          note
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not submit");
        return;
      }
      setDone(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(20);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50 fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[80] rounded-t-3xl border-t border-border bg-surface px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

        {done ? (
          <div className="pb-4 text-center">
            <div className="text-[2.5rem]">✅</div>
            <h2 className="mt-3 font-serif text-[1.25rem] font-semibold text-ink">
              Report sent
            </h2>
            <p className="mt-2 text-[0.875rem] text-muted">
              Our moderators will review it. We don't tell the other person who
              reported them.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-accent py-3 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-accent-deep"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-[1.25rem] font-semibold text-ink">
              Report {targetLabel}
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Your report is anonymous. The other person won't see it was you.
            </p>

            <div className="mt-4 space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    reason === r.id
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-paper hover:border-border-strong"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      reason === r.id
                        ? "border-accent bg-accent"
                        : "border-border-strong"
                    }`}
                  >
                    {reason === r.id ? (
                      <span className="text-[0.65rem] font-bold text-white">
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-medium text-ink">
                      {r.label}
                    </p>
                    <p className="text-[0.75rem] text-muted">{r.hint}</p>
                  </div>
                </button>
              ))}
            </div>

            {reason === "other" ? (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="Tell us wetin happen…"
                rows={3}
                className="mt-3 !min-h-[80px] text-[0.875rem]"
              />
            ) : null}

            {error ? (
              <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-border-strong bg-paper py-3 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !reason}
                className="flex-1 rounded-xl bg-danger py-3 text-[0.875rem] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Submit report"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}