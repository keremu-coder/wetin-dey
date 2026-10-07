"use client";

import { useState } from "react";
import { unlockAudio, vibrate } from "@/lib/sounds";

const MIN_BODY = 50;
const MAX_BODY = 2000;
const MIN_NAME = 2;
const MAX_NAME = 120;
const MAX_CONTACT = 200;

export function ReportReplyForm({
  reportId,
  onClose
}: {
  reportId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy) return;
    unlockAudio();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/${reportId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, contact, body })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not submit");
        return;
      }
      setDone(true);
      vibrate(25);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[90] max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

        {done ? (
          <div className="pb-4 text-center">
            <div className="text-[2.5rem]">✅</div>
            <h2 className="mt-3 font-serif text-[1.25rem] font-semibold text-ink">
              Response submitted
            </h2>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
              A moderator will review your response. If approved, it will
              publish attached to the report — visible to every reader.
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
              Right of reply
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              If you are named in this report, you can submit a response. Once
              approved, your response appears attached to the report — every
              reader sees both sides.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
                  placeholder="Full name"
                  maxLength={MAX_NAME}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
                  Email or phone
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) =>
                    setContact(e.target.value.slice(0, MAX_CONTACT))
                  }
                  placeholder="For our verification only"
                  maxLength={MAX_CONTACT}
                />
                <p className="mt-1 text-[0.7rem] text-faint">
                  Used to verify you are who you say you are. Never shown
                  publicly.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
                  Your response
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
                  placeholder="Explain your position on this report."
                  rows={6}
                  maxLength={MAX_BODY}
                />
                <p className="mt-1 text-right font-mono text-[0.65rem] text-faint">
                  {body.length}/{MAX_BODY}
                  {body.length < MIN_BODY
                    ? ` · ${MIN_BODY - body.length} more needed`
                    : ""}
                </p>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
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
                disabled={
                  busy ||
                  name.trim().length < MIN_NAME ||
                  contact.trim().length < 5 ||
                  body.trim().length < MIN_BODY
                }
                className="flex-1 rounded-xl bg-accent py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
              >
                {busy ? "Submitting…" : "Submit response"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}