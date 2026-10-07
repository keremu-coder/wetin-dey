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
          If you are named in a report and believe it is false, defamatory, or
          unlawful, submit a dispute. We review within 24 hours. Reports are
          labelled as disputed — they are not deleted. The archive keeps its
          record.
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
            <p className="mt-1 text-[0.75rem] text-faint">
              Copy the URL from the report page.
            </p>
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

      <article className="mt-10 space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What happens next
          </h2>
          <ol className="ml-5 list-decimal space-y-1.5">
            <li>We review your dispute within 24 hours.</li>
            <li>
              If the report is unsubstantiated, we label it{" "}
              <strong>Disputed</strong> — visible to every reader.
            </li>
            <li>
              If you provide evidence, we publish your verified response
              attached to the report so every reader sees both sides.
            </li>
            <li>
              If your dispute is rejected, we tell you why.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What Wetin Dey will and will not do
          </h2>
          <p>Wetin Dey will:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1.5">
            <li>
              Label a report <strong>Disputed</strong> if the claim is
              contested.
            </li>
            <li>Publish your verified rebuttal alongside the report.</li>
            <li>
              Remove content that names a minor, constitutes a threat, is
              doxxing, or is illegal under Nigerian law.
            </li>
          </ul>
          <p className="mt-2">Wetin Dey will not:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1.5">
            <li>
              Delete a report solely because its subject disputes it. Reports
              are never deleted. This is a deliberate policy that protects the
              integrity of the public archive.
            </li>
            <li>
              Remove criticism of a public agency or of a public official
              acting in their official capacity.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Urgent cases
          </h2>
          <p>
            For threats of violence, doxxing of a minor, or content that
            creates an immediate safety risk, email{" "}
            <a
              href="mailto:support@wetindey.app?subject=URGENT"
              className="text-accent underline"
            >
              support@wetindey.app
            </a>{" "}
            with subject <strong>&ldquo;URGENT&rdquo;</strong> and we will
            prioritize review.
          </p>
        </section>

        <div className="rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
          <p className="text-[0.8125rem] leading-relaxed text-ink">
            <strong>Draft notice:</strong> this copy is written in plain
            language and is pending review by a Nigerian lawyer familiar with
            Nigerian defamation law and the Cybercrimes Act 2015. It is not
            legal advice.
          </p>
        </div>
      </article>
    </main>
  );
}