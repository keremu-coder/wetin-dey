"use client";

import { useEffect, useState } from "react";
import { unlockAudio, vibrate } from "@/lib/sounds";

export function RecoveryCodeCard() {
  const [code, setCode] = useState<string | null>(null);
  const [hasCode, setHasCode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/recovery-code", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setHasCode(Boolean(d?.has_code));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function regenerate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/recovery-code", {
        method: "POST"
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not generate");
        return;
      }
      setCode(json.recovery_code);
      setRevealed(true);
      setHasCode(true);
      setConfirmRegen(false);
      vibrate(25);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    unlockAudio();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      vibrate(15);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  function dismiss() {
    setCode(null);
    setRevealed(false);
  }

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
            Recovery code
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Your key to this identity. Save it somewhere safe — you can use it
            to sign back in from any device, even after signing out.
          </p>
        </div>
        <span className="shrink-0 text-[1.5rem]">🔑</span>
      </div>

      {code ? (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/30 px-3 py-3">
            <code
              className={`flex-1 truncate font-mono text-[1.05rem] font-bold tracking-wider text-ink ${
                revealed ? "" : "blur-[6px] select-none"
              }`}
            >
              {code}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="shrink-0 rounded-lg border border-border-strong bg-paper px-2.5 py-1.5 text-[0.7rem] font-medium text-ink transition-colors hover:bg-ink/5"
            >
              {revealed ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[0.7rem] font-semibold text-white transition-colors hover:bg-accent-deep"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 rounded-xl bg-gold-soft/50 p-3">
            <p className="text-[0.75rem] leading-relaxed text-ink">
              <strong>Save this now.</strong> Write it down. Screenshot it.
              Put it in your Notes app. We never store the code itself — only
              a hash — so this is the last time you&apos;ll see it. If you lose
              it, you can generate a new one, but the old one stops working.
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="mt-3 w-full rounded-xl border border-border-strong bg-paper py-2.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5"
          >
            I have saved it
          </button>
        </>
      ) : hasCode ? (
        <div className="mt-4">
          <p className="text-[0.8125rem] text-muted">
            You have a recovery code on file. For security we can&apos;t show
            it again — if you saved it, you&apos;re fine. If you lost it,
            generate a new one.
          </p>
          {!confirmRegen ? (
            <button
              type="button"
              onClick={() => setConfirmRegen(true)}
              className="mt-3 w-full rounded-xl border border-danger/40 bg-danger-soft py-2.5 text-[0.875rem] font-semibold text-danger transition-colors hover:bg-danger/10"
            >
              Generate a new code (loses the old one)
            </button>
          ) : (
            <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft p-3">
              <p className="text-[0.75rem] text-ink">
                This replaces your current code. Any saved copy of the old one
                stops working immediately.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRegen(false)}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-border-strong bg-paper px-3 py-1.5 text-[0.75rem] font-medium text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-danger px-3 py-1.5 text-[0.75rem] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "…" : "Yes, replace"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[0.8125rem] text-muted">
            You haven&apos;t generated a recovery code yet. Without one,
            signing out means losing this identity permanently.
          </p>
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-accent py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate my recovery code"}
          </button>
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}