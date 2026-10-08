"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [deleteContent, setDeleteContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (confirm !== "DELETE") {
      setError("Type DELETE exactly — capital letters — to confirm.");
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: "DELETE",
          delete_content: deleteContent
        })
      });

      let json: { ok?: boolean; error?: string } = {};
      try {
        json = await res.json();
      } catch {
        setError("Server returned an unexpected response. Try again.");
        setBusy(false);
        return;
      }

      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }

      router.push("/?deleted=1");
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/settings"
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← Back to settings
        </Link>
        <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-tight text-danger">
          Delete your account
        </h1>
      </div>

      <div className="mb-6 rounded-2xl border border-danger/30 bg-danger-soft/40 p-5">
        <p className="text-[0.9375rem] font-semibold text-danger">
          This cannot be undone.
        </p>

        <p className="mt-3 text-[0.875rem] font-semibold text-ink">
          What we delete right away:
        </p>
        <ul className="mt-1.5 space-y-1 text-[0.875rem] leading-relaxed text-ink/85">
          <li>• Your email and phone number</li>
          <li>• Your Supabase sign-in record</li>
          <li>• Your avatar and any space avatars you uploaded</li>
          <li>• Your voice broadcasts and their audio</li>
          <li>• Your followers, following, and blocks</li>
          <li>• Your push notification subscriptions</li>
          <li>• Your check-ins, daily answers, radar signals, and profile status</li>
          <li>• Your reaction history and votes</li>
        </ul>

        <p className="mt-3 text-[0.875rem] font-semibold text-ink">
          What stays, but is detached from you:
        </p>
        <ul className="mt-1.5 space-y-1 text-[0.875rem] leading-relaxed text-ink/85">
          <li>
            • Your reports and comments stay visible, but they no longer carry
            your session id or handle. We replace both with a placeholder.
          </li>
          <li>
            • Your direct messages stay, so the other person doesn&apos;t lose
            the conversation. Their sender id points to a ghost profile with
            no email, no login, and a generic handle.
          </li>
        </ul>
      </div>

      <form onSubmit={handleDelete} className="space-y-5">
        <div>
          <label
            htmlFor="confirm"
            className="mb-2 block text-[0.8125rem] font-semibold text-ink"
          >
            Type{" "}
            <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[0.75rem]">
              DELETE
            </code>{" "}
            to confirm
          </label>
          <input
            id="confirm"
            type="text"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <input
            type="checkbox"
            checked={deleteContent}
            onChange={(e) => setDeleteContent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-[0.875rem] leading-relaxed text-ink">
            <span className="font-medium">
              Also delete my chat messages
            </span>
            <span className="mt-1 block text-muted">
              Deletes the messages you sent in community spaces. Reports and
              comments still stay (detached), because removing them would
              break the archive. Direct messages stay so the other person
              doesn&apos;t lose the conversation.
            </span>
          </span>
        </label>

        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
            <p className="text-[0.875rem] text-danger">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-2xl bg-danger px-5 py-3 font-serif text-[1rem] font-semibold text-white shadow-button transition-all hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Dey delete…" : "Delete my account"}
          </button>
          <Link
            href="/settings"
            className="flex-1 rounded-2xl border border-border-strong bg-surface px-5 py-3 text-center text-[0.9375rem] font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}