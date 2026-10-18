"use client";
import { useState } from "react";
import Link from "next/link";

export function ChoosePath({ onChooseAnonymous }: { onChooseAnonymous: () => void }) {
  const [loading, setLoading] = useState(false);

  function handleAnon() {
    setLoading(true);
    // Save their choice to localStorage so we don't ask again
    localStorage.setItem("wd_path_chosen", "anonymous");
    onChooseAnonymous();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-serif text-[2rem] font-semibold text-ink text-center">How you wan enter?</h1>
      <p className="mt-2 text-center text-[0.9375rem] text-muted mb-8">
        You fit stay anonymous, or create a profile to save your handle and connect with friends.
      </p>

      <button
        onClick={handleAnon}
        disabled={loading}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-brand bg-brand-tint/30 p-6 transition-colors hover:bg-brand-tint/60"
      >
        <span className="text-[1.1rem] font-bold text-brand">Stay Anonymous</span>
        <span className="mt-1 text-center text-[0.8125rem] text-brand/80">
          No phone number, no email. Just a random handle. You can still talk am.
        </span>
      </button>

      <div className="relative my-6 text-center">
        <span className="bg-paper px-4 text-[0.75rem] font-semibold uppercase tracking-widest text-faint">Or</span>
      </div>

      <Link
        href="/join"
        onClick={() => localStorage.setItem("wd_path_chosen", "signup")}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-border bg-surface p-6 transition-colors hover:border-ink/30 hover:bg-ink/5"
      >
        <span className="text-[1.1rem] font-bold text-ink">Create a Profile</span>
        <span className="mt-1 text-center text-[0.8125rem] text-muted">
          Claim your handle, set a status, and save your account with email or recovery code.
        </span>
      </Link>
    </main>
  );
}
