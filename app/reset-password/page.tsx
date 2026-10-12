"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    setAccessToken(params.get("access_token") ?? "");
    setRefreshToken(params.get("refresh_token") ?? "");
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords no match.");
      return;
    }
    if (!accessToken || !refreshToken) {
      setError("Reset link invalid. Request a new one.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, accessToken, refreshToken })
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something go wrong. Try again.");
      setBusy(false);
      return;
    }

    setDone(true);
    setBusy(false);
    setTimeout(() => router.push("/signin"), 2500);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/signin"
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-brand"
        >
          ← Back to sign in
        </Link>
        <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-tight text-ink">
          Set new password
        </h1>
      </div>

      {done ? (
        <div className="rounded-2xl border border-brand/30 bg-brand-tint/60 p-5">
          <p className="font-serif text-[1.1rem] font-semibold text-brand">
            Password don change ✅
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/85">
            Redirecting you to sign in…
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="mb-2 block text-[0.8125rem] font-semibold text-ink">
              New password <span className="ml-2 font-normal text-faint">min 8 chars</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-2 block text-[0.8125rem] font-semibold text-ink">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
              <p className="text-[0.875rem] text-danger">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-warm px-5 py-4 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-warm-deep disabled:opacity-60"
          >
            {busy ? "Dey save…" : "Set new password"}
          </button>
        </form>
      )}
    </main>
  );
}