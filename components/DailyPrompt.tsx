"use client";

import { useEffect, useState } from "react";
import { unlockAudio, vibrate } from "@/lib/sounds";

type PromptInfo = {
  id: string;
  text: string;
  hint: string;
  date: string;
};

type Answer = {
  id: string;
  body: string;
  created_at: string;
};

export function DailyPrompt() {
  const [prompt, setPrompt] = useState<PromptInfo | null>(null);
  const [count, setCount] = useState(0);
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.prompt) return;
        setPrompt(d.prompt as PromptInfo);
        setCount(d.answer_count ?? 0);
        setMyAnswer((d.my_answer as Answer | null) ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    unlockAudio();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        return;
      }
      setMyAnswer(json.answer as Answer);
      setCount(json.answer_count ?? 0);
      setDraft("");
      setEditing(false);
      vibrate(25);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !prompt) return null;

  const showingInput = !myAnswer || editing;

  return (
    <section className="mb-6 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[0.65rem] uppercase tracking-wider text-brand">
          Today's question
        </p>
        <p className="font-mono text-[0.65rem] text-faint">
          {count} answer{count === 1 ? "" : "s"}
        </p>
      </div>

      <h2 className="mt-2 font-serif text-[1.2rem] font-semibold leading-tight text-ink">
        {prompt.text}
      </h2>
      <p className="mt-1 text-[0.75rem] text-muted">{prompt.hint}</p>

      {showingInput ? (
        <div className="mt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 280))}
            placeholder="Your answer…"
            rows={2}
            className="!min-h-[64px] text-[0.9375rem]"
            autoFocus={editing}
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="font-mono text-[0.65rem] text-faint">
              {draft.length}/280
            </p>
            <div className="flex gap-2">
              {editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft("");
                  }}
                  className="rounded-lg border border-border-strong bg-paper px-3 py-1.5 text-[0.75rem] font-medium text-ink transition-colors hover:bg-ink/5"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !draft.trim()}
                className="rounded-lg bg-brand px-4 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-40"
              >
                {busy ? "Sending…" : "Answer"}
              </button>
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-[0.75rem] text-danger">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-tint/60 p-3">
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            {myAnswer!.body}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-[0.7rem] text-muted">
              You don answer today ✓
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(myAnswer!.body);
                setEditing(true);
              }}
              className="text-[0.7rem] font-medium text-brand hover:underline"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}