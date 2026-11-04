"use client";

import { useState } from "react";
import Link from "next/link";

export default function DeleteAccountPage() {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: "DELETE",
          delete_content: true
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not delete account.");
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Delete Account
        </h1>
      </div>

      <div className="rounded-2xl border border-danger/30 bg-danger-soft p-5">
        <p className="font-serif text-[1.15rem] font-semibold text-danger">
          This cannot be undone.
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink/85">
          Deleting your account will:
        </p>
        <ul className="mt-3 ml-5 list-disc space-y-1 text-[0.875rem] text-ink/85">
          <li>Remove your handle, profile, avatar, and status photo immediately</li>
          <li>
            Detach your reports and comments from your identity &mdash; they
            stay in the public archive, no longer linked to you
          </li>
          <li>Delete your direct messages, DM media, and community chat messages</li>
          <li>Delete any space avatars you uploaded as an owner</li>
          <li>Delete your community memberships, Radar contacts, and push subscriptions</li>
        </ul>
        <p className="mt-3 text-[0.875rem] font-semibold text-ink">
          Your identity is removed from everything you&apos;ve posted. The
          civic archive keeps the records, detached from you.
        </p>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
          Full detail in the{" "}
          <Link href="/privacy" className="underline hover:text-brand">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
            Type <strong className="text-danger">DELETE</strong> to confirm
          </label>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="w-full"
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={confirm !== "DELETE" || loading}
          className="w-full rounded-xl bg-danger py-3 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
        >
          {loading ? "Deleting…" : "Delete My Account Forever"}
        </button>
      </form>
    </main>
  );
}