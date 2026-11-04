"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unlockAudio, vibrate } from "@/lib/sounds";
import {
  formatRecoveryCode,
  normalizeRecoveryCode,
  isValidRecoveryCodeFormat
} from "@/lib/recovery-code-format";

export function RecoverySigninForm() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const display = raw.length > 0 ? formatRecoveryCode(raw) : "";

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = normalizeRecoveryCode(e.target.value);
    setRaw(cleaned);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValidRecoveryCodeFormat(raw)) {
      setError("Recovery codes are 16 characters. Check and try again.");
      return;
    }

    unlockAudio();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/auth/signin-recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recovery_code: raw })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not sign in");
        return;
      }
      vibrate(25);
      // Hard navigate so middleware re-issues based on the new cookie
      window.location.href = "/";
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const complete = isValidRecoveryCodeFormat(raw);

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <label className="mb-2 block font-mono text-[0.65rem] uppercase tracking-wider text-faint">
        Recovery code
      </label>

      <input
        type="text"
        value={display}
        onChange={onChange}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={19} // 16 chars + 3 dashes
        disabled={busy}
        className="!text-center !font-mono !text-[1.15rem] !tracking-widest !uppercase"
      />

      {error ? (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !complete}
        className="mt-4 w-full rounded-xl bg-brand py-3.5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-40"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-muted">
        Codes are case-insensitive. Dashes are optional.
      </p>
    </form>
  );
}