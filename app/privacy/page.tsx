import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Wetin Dey"
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
          Last updated
        </p>
        <p className="mt-1 text-[0.875rem] text-ink">8 October 2026</p>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <p>
          Wetin Dey is a community platform for anonymous civic reports from
          Nigerian citizens. This policy explains what we collect, what we do
          not, and your rights under the Nigeria Data Protection Regulation
          (NDPR).
        </p>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What we collect
          </h2>
          <p>
            <strong>Anonymous activity:</strong> a random session identifier
            stored in a signed HTTP-only cookie. No phone number. No email
            address. No IP address logged for anonymous reports, comments, or
            messages.
          </p>
          <p className="mt-2">
            <strong>Optional account recovery:</strong> you may attach an email
            address or phone number to your session for recovery. This is
            optional and removable at any time. Reports you post stay anonymous
            regardless.
          </p>
          <p className="mt-2">
            <strong>Uploaded files:</strong> photos, videos, audio, and voice
            notes. All EXIF metadata (GPS, camera model, timestamp) is stripped
            before storage.
          </p>
          <p className="mt-2">
            <strong>Presence:</strong> a last-seen timestamp that powers the
            online indicator. You can hide it entirely in Settings → Presence.
          </p>
          <p className="mt-2">
            <strong>Push notifications:</strong> if enabled, we store the push
            subscription your browser issues. You can disable it anytime.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What we do not collect
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Phone numbers (unless you add one for recovery)</li>
            <li>Email addresses (unless you add one for recovery)</li>
            <li>
              Precise location — Radar rounds to about 1 km, nothing finer
            </li>
            <li>IP addresses for anonymous reports</li>
            <li>
              Tracking pixels, fingerprinting scripts, or third-party analytics
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Who processes your data
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Supabase</strong> (database, storage, realtime) — EU
              region
            </li>
            <li>
              <strong>Vercel</strong> (hosting) — global edge network
            </li>
            <li>
              <strong>Groq</strong> (AI formalization of report text only,
              never files) — US
            </li>
            <li>
              <strong>Telegram</strong> (public mirror of reviewed reports only)
            </li>
          </ul>
          <p className="mt-2">
            We do not sell your data. We do not run ads on the Talk Am civic
            feed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Your rights (NDPR)
          </h2>
          <p>Under the Nigeria Data Protection Regulation you can:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for optional processing</li>
          </ul>
          <p className="mt-2">
            Because reports are never deleted (see the{" "}
            <Link href="/terms" className="text-accent underline">
              Terms
            </Link>
            ), deleting your account removes your identifying information from
            our system but does not remove the anonymized report content.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Contact
          </h2>
          <p>
            Questions or requests:{" "}
            <a
              href="mailto:support@wetindey.app"
              className="text-accent underline"
            >
              support@wetindey.app
            </a>
          </p>
        </section>

        <div className="rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
          <p className="text-[0.8125rem] leading-relaxed text-ink">
            <strong>Draft notice:</strong> this copy is written in plain
            language and is pending review by a Nigerian lawyer familiar with
            the NDPR and the Cybercrimes Act 2015. It is not legal advice.
          </p>
        </div>
      </article>
    </main>
  );
}