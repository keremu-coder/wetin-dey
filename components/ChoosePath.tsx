"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ChoosePath() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChoice(path: "anonymous" | "signup") {
    setLoading(true);
    try {
      await fetch("/api/auth/choose-path", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path })
      });

      if (path === "signup") {
        router.push("/join");
      } else {
        // Refresh the server component to hide this screen
        router.refresh();
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-serif text-[2rem] font-semibold text-ink text-center">
        How you wan enter?
      </h1>
      <p className="mt-2 text-center text-[0.9375rem] text-muted mb-8">
        You fit stay anonymous, or create a profile to save your handle and connect with friends.
      </p>

      <button
        onClick={() => handleChoice("anonymous")}
        disabled={loading}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-brand bg-brand-tint/30 p-6 transition-colors hover:bg-brand-tint/60 disabled:opacity-50"
      >
        <span className="text-[1.1rem] font-bold text-brand">Stay Anonymous</span>
        <span className="mt-1 text-center text-[0.8125rem] text-brand/80">
          No phone number, no email. Just a random handle. You can still talk am.
        </span>
      </button>

      <div className="relative my-6 text-center">
        <span className="bg-paper px-4 text-[0.75rem] font-semibold uppercase tracking-widest text-faint">
          Or
        </span>
      </div>

      <button
        onClick={() => handleChoice("signup")}
        disabled={loading}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-border bg-surface p-6 transition-colors hover:border-ink/30 hover:bg-ink/5 disabled:opacity-50"
      >
        <span className="text-[1.1rem] font-bold text-ink">Create a Profile</span>
        <span className="mt-1 text-center text-[0.8125rem] text-muted">
          Claim your handle, set a status, and save your account with email or recovery code.
        </span>
      </button>

      <p className="mt-8 text-center text-[0.875rem] text-muted">
        Already get account?{" "}
        <Link href="/signin" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
