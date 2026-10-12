"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function JoinPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [suggestedHandle, setSuggestedHandle] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.handle) {
          setSuggestedHandle(d.handle);
          setHandle(d.handle);
        }
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("You must agree to the Terms and Community Guidelines.");
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          handle,
          terms_accepted: true
        })
      });

      let json: {
        ok?: boolean;
        error?: string;
        handle?: string;
        verification_email_sent?: boolean;
      } = {};
      try {
        json = await res.json();
      } catch {
        setError("Server returned an unexpected response. Try again.");
        setBusy(false);
        return;
      }

      if (!res.ok || !json.ok) {
        setError(json.error ?? "Something go wrong. Try again.");
        setBusy(false);
        return;
      }

      router.push("/me?joined=1");
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8">
        <p className="font-mono text-[0.7rem] uppercase tracking-widest text-faint">
          Join Wetin Dey
        </p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-tight text-ink">
          Claim your handle
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          If you want to build a name here, sign up. If you want to stay quiet,
          stay anonymous — e still work. You fit upgrade anytime.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-2xl border border-brand/25 bg-brand-tint/60 p-4">
          <p className="text-[0.8125rem] leading-relaxed text-brand">
            <strong className="font-semibold">Named account:</strong> You get a
            profile, followers, and people fit follow your posts. Your handle
            shows on everything you post publicly — you can still post
            anonymously when you want.
          </p>
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-[0.8125rem] font-semibold text-ink"
          >
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
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-faint">
            We&apos;ll send a verification link. You can use Wetin Dey right
            away — but password reset only works after you verify.
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-[0.8125rem] font-semibold text-ink"
          >
            Password{" "}
            <span className="ml-2 text-[0.75rem] font-normal text-faint">
              min 8 chars
            </span>
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
          <label
            htmlFor="handle"
            className="mb-2 block text-[0.8125rem] font-semibold text-ink"
          >
            Handle{" "}
            <span className="ml-2 text-[0.75rem] font-normal text-faint">
              3–20 chars, letters/numbers/_
            </span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              @
            </span>
            <input
              id="handle"
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="LagosVibes_4829"
              className="!pl-9"
            />
          </div>
          {suggestedHandle && suggestedHandle === handle ? (
            <p className="mt-1.5 text-[0.75rem] text-faint">
              Na the anonymous handle you already get. You fit change am.
            </p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
            required
          />
          <span className="text-[0.875rem] leading-relaxed text-ink">
            I agree to the{" "}
            <Link href="/terms" className="text-brand underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/guidelines" className="text-brand underline">
              Community Guidelines
            </Link>
            .
            <span className="mt-1 block text-muted">
              No threats. No doxxing. No attacks on religion, ethnicity, or
              politics. Content that breaks these rules is removed within 24
              hours. Abusive users are ejected.
            </span>
          </span>
        </label>

        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
            <p className="text-[0.875rem] text-danger">{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy || !agreed}
          className="w-full rounded-2xl bg-warm px-5 py-4 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-warm-deep hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Dey create account…" : "Create account"}
        </button>

        <p className="text-center text-[0.75rem] text-faint">
          You can still post anonymously anytime. Nobody go link your posts to
          your name unless you choose.
        </p>
      </form>
    </main>
  );
}