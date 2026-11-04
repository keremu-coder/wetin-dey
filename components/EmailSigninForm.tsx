"use client";

import { useState } from "react";
import { clearWhoAmICache } from "@/lib/whoami-cache";

export function EmailSigninForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Could not sign in.");
        setBusy(false);
        return;
      }
      // Clear the stale anonymous handle from the Nav cache
      clearWhoAmICache();
      // Hard reload to guarantee fresh session state
      window.location.href = "/";
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="signin-email" className="mb-1.5 block text-[0.8125rem] font-medium text-faint">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full"
        />
      </div>

      <div>
        <label htmlFor="signin-password" className="mb-1.5 block text-[0.8125rem] font-medium text-faint">
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          className="w-full"
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !email || !password}
        className="w-full rounded-xl bg-brand px-4 py-3 text-[0.9375rem] font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
