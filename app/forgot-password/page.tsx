"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      setError("Something go wrong. Try again.");
      setBusy(false);
      return;
    }

    setSent(true);
    setBusy(false);
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
          Reset password
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          Enter the email you used to sign up. We go send you a link to set a new password.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-brand/30 bg-brand-tint/60 p-5">
          <p className="font-serif text-[1.1rem] font-semibold text-brand">
            Check your email
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/85">
            If <strong className="font-semibold">{email}</strong> dey our records, we don send a reset link.
            Click the link inside to set a new password.
          </p>
          <p className="mt-3 text-[0.8125rem] text-muted">
            No email after 5 minutes? Check spam folder.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-[0.8125rem] font-semibold text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
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
            {busy ? "Dey send…" : "Send reset link"}
          </button>
        </form>
      )}
    </main>
  );
}