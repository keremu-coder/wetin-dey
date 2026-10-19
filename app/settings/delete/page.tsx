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
          delete_content: true // ALWAYS delete everything
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
          Deleting your account will permanently remove:
        </p>
        <ul className="mt-3 ml-5 list-disc space-y-1 text-[0.875rem] text-ink/85">
          <li>Your handle and profile</li>
          <li>All your posts, reports, and comments</li>
          <li>All your direct messages and DM media</li>
          <li>All your community memberships</li>
          <li>Your Radar contacts and signals</li>
          <li>Your push subscriptions</li>
        </ul>
        <p className="mt-3 text-[0.875rem] font-semibold text-ink">
          Everything you have uploaded will be deleted immediately and permanently.
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
