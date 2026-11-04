"use client";

import { useState } from "react";

const REASONS = [
  { id: "harassment", label: "Harassment or threats" },
  { id: "spam", label: "Spam or scam" },
  { id: "hate", label: "Hate speech" },
  { id: "explicit", label: "Explicit content" },
  { id: "other", label: "Something else" }
];

export function DMReportButton({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit() {
    if (!selected) return;
    setState("sending");
    const reason = REASONS.find((r) => r.id === selected)?.label ?? selected;
    const fullReason = detail.trim() ? `${reason}: ${detail.trim()}` : reason;
    try {
      const res = await fetch("/api/dm/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, reason: fullReason })
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="text-[0.65rem] text-faint">Reported</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[0.65rem] text-faint underline hover:text-ink"
      >
        Report
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl border-t border-border bg-surface p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />
            <h3 className="font-serif text-[1.15rem] font-semibold text-ink">Report message</h3>
            <p className="mt-1 text-[0.8125rem] text-muted">Why are you reporting this message?</p>
            <div className="mt-4 space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-[0.9375rem] transition-colors ${
                    selected === r.id ? "border-brand bg-brand-tint text-brand" : "border-border bg-surface text-ink hover:bg-ink/5"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 300))}
              placeholder="Add details (optional)"
              rows={2}
              className="mt-3 !min-h-[60px] text-[0.875rem]"
            />
            {state === "error" ? (
              <p className="mt-2 text-[0.75rem] text-danger">Could not send report. Try again.</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-border-strong bg-paper py-3 text-[0.875rem] font-medium text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!selected || state === "sending"}
                className="flex-1 rounded-xl bg-danger py-3 text-[0.875rem] font-semibold text-white disabled:opacity-50"
              >
                {state === "sending" ? "Sending…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
