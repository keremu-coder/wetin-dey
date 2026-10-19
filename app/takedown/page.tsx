import Link from "next/link";

export const metadata = {
  title: "Takedown & Dispute — Wetin Dey"
};

export default function TakedownPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 pb-28">
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

      <div className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/85">
        <p>
          Wetin Dey is built to preserve public records and community voices. However, we take safety, privacy, and legal compliance seriously.
        </p>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-serif text-[1.15rem] font-semibold text-ink mb-2">When to request a takedown</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted">
            <li><strong className="text-ink">Copyright Infringement:</strong> If content you own is posted without permission.</li>
            <li><strong className="text-ink">Privacy Violation:</strong> If someone posted your private information (doxxing, phone numbers, exact addresses).</li>
            <li><strong className="text-ink">Harassment or Threats:</strong> If you are being targeted with abusive content.</li>
            <li><strong className="text-ink">False Information:</strong> If a report contains defamatory claims that can be proven false.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-serif text-[1.15rem] font-semibold text-ink mb-2">How to submit a request</h2>
          <p className="text-muted mb-3">
            Please send an email to <strong className="text-ink">support@wetindey.app</strong> with the subject line <strong className="text-ink">"Takedown Request"</strong>.
          </p>
          <p className="text-muted">
            Include the following details:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-muted">
            <li>A link to the specific post or profile.</li>
            <li>A description of the issue.</li>
            <li>Proof of ownership or identity (if applicable).</li>
          </ul>
        </div>

        <p className="text-[0.875rem] text-muted">
          We review all requests manually. If approved, the content will be removed or hidden from the public archive. We may reach out for further verification. Please allow up to 48 hours for a response.
        </p>
      </div>
    </main>
  );
}
