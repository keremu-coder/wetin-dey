"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Dedicated route for email verification clicks.
 *
 * Supabase redirects the signup confirmation link here (set via
 * emailRedirectTo in /api/join and /api/auth/forgot-password). This
 * page owns the token-fragment → server handshake, which means the
 * rest of the app no longer needs to mount a Supabase client on every
 * page load. That unmounts ~318 KB of gotrue crypto from the initial
 * bundle of /signin, /privacy, /terms, and every public page.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || hash.length < 2) {
      setState("error");
      setMessage("No verification token in this link.");
      return;
    }

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");
    const accessToken = params.get("access_token");
    if (type !== "signup" || !accessToken) {
      setState("error");
      setMessage("That link no correct or e don expire.");
      return;
    }

    try {
      window.history.replaceState({}, "", "/auth/verify");
    } catch {
      /* ignore */
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token: accessToken })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) {
          setState("ok");
          setMessage("Email confirmed. Taking you back…");
          setTimeout(() => router.replace("/settings/account"), 1200);
        } else {
          setState("error");
          setMessage("We couldn't confirm that link. Try again from Settings.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Network error. Try again in a moment.");
      });
  }, [router]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 pb-24">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        {state === "working" ? (
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        ) : null}
        <h1 className="font-serif text-[1.35rem] font-semibold text-ink">
          {state === "ok" ? "Email confirmed" : state === "error" ? "Verification failed" : "Verifying"}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-muted">{message}</p>
        {state === "error" ? (
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/settings/account"
              className="rounded-xl bg-brand px-4 py-2.5 text-[0.875rem] font-semibold text-white"
            >
              Go to Settings
            </Link>
            <Link href="/" className="text-[0.8125rem] text-brand hover:underline">
              Back to home
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}