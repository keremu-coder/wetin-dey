import Link from "next/link";

export const metadata = {
  title: "Takedown & Dispute — Wetin Dey"
};

export default function TakedownPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Takedown &amp; Dispute
        </h1>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            If you are named in a report
          </h2>
          <p>
            Wetin Dey publishes reports submitted by anonymous members of the
            public. If you are named and believe a report is false, misleading,
            or defamatory, you have two paths:
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            1. Right of reply (fastest)
          </h2>
          <ol className="ml-5 list-decimal space-y-1.5">
            <li>Open the report page.</li>
            <li>
              Click{" "}
              <strong>
                &ldquo;I&apos;m named in this report — submit a reply&rdquo;
              </strong>
              .
            </li>
            <li>
              Provide your full name, a contact method (email or phone), and
              your response.
            </li>
            <li>
              A moderator reviews your submission within a reasonable period.
            </li>
            <li>
              If approved, your response is published attached to the report,
              visible to every reader, and marked <strong>✓ Verified</strong>.
            </li>
            <li>
              If rejected, you are notified with the reason.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            2. Formal takedown request
          </h2>
          <p>
            Email{" "}
            <a
              href="mailto:support@wetindey.app?subject=Takedown"
              className="text-accent underline"
            >
              support@wetindey.app
            </a>{" "}
            with subject <strong>&ldquo;Takedown&rdquo;</strong> and include:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1.5">
            <li>The exact report URL (the /r/[id] link)</li>
            <li>Your name and relationship to the report</li>
            <li>The specific grounds for removal</li>
            <li>Any supporting evidence</li>
          </ul>
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