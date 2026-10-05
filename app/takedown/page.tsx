"use client";

import { useState } from "react";
import Link from "next/link";

export default function TakedownPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [explanation, setExplanation] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const res = await fetch("/api/takedown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postUrl, name, contact, explanation })
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong. Try again.");
      setBusy(false);
      return;
    }

    setSent(true);
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6">
        <Link
          href="/"
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← Back
        </Link>
        <h1 className="mt-3 font-serif text-[1.75rem] font-semibold leading-tight text-ink">
          Dispute a report
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          If you are named in a report and you believe it is false, submit a
          dispute. We review within 24 hours. Reports are labelled as disputed
          — they are not deleted.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-5">
          <p className="font-serif text-[1.1rem] font-semibold text-accent-deep">
            Dispute received
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/85">
            A moderator will review your dispute within 24 hours. If the report
            is unsubstantiated, we will label it as Disputed and add your
            response to the page.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
              Link to the report
            </label>
            <input
              type="url"
              required
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://9jawatindey.vercel.app/r/..."
            />
          </div>

          <div>
            <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
              Your name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
              How can we reach you?
            </label>
            <input
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email or phone — we will not publish it"
            />
          </div>

          <div>
            <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
              Why is this report false or unfair?
            </label>
            <textarea
              required
              minLength={30}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={6}
              placeholder="Give specifics. What is wrong? Do you have proof?"
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
            {busy ? "Sending…" : "Submit dispute"}
          </button>
        </form>
      )}
    </main>
  );
}