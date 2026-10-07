"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unlockAudio, vibrate } from "@/lib/sounds";

type Policy = "everyone" | "following";

export function DMPolicyForm({
  initialPolicy
}: {
  initialPolicy: Policy;
}) {
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy>(initialPolicy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(next: Policy) {
    if (next === policy || busy) return;
    unlockAudio();
    setBusy(true);
    setError("");
    setSaved(false);
    const previous = policy;
    setPolicy(next);

    try {
      const res = await fetch("/api/settings/dm-policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy: next })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        setPolicy(previous);
        return;
      }
      vibrate(20);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error");
      setPolicy(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => save("everyone")}
        disabled={busy}
        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
          policy === "everyone"
            ? "border-accent bg-accent-soft/40"
            : "border-border-strong hover:bg-ink/5"
        } disabled:opacity-60`}
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            policy === "everyone"
              ? "border-accent bg-accent"
              : "border-border-strong"
          }`}
        >
          {policy === "everyone" ? (
            <span className="text-[0.65rem] font-bold text-white">✓</span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold text-ink">
            Everyone
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
            Any signed-in user can start a conversation with you.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => save("following")}
        disabled={busy}
        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
          policy === "following"
            ? "border-accent bg-accent-soft/40"
            : "border-border-strong hover:bg-ink/5"
        } disabled:opacity-60`}
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            policy === "following"
              ? "border-accent bg-accent"
              : "border-border-strong"
          }`}
        >
          {policy === "following" ? (
            <span className="text-[0.65rem] font-bold text-white">✓</span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold text-ink">
            Only people I follow
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
            Only people you already follow can start a new conversation. Good
            if you&apos;re getting spam or unwanted attention.
          </p>
        </div>
      </button>

      {saved ? (
        <p className="mt-2 text-center text-[0.75rem] font-medium text-accent-deep">
          ✓ Saved
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}