import Link from "next/link";

export const metadata = {
  title: "Terms of Use — Wetin Dey"
};

export default function TermsPage() {
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
          Terms of Use
        </h1>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
          Last updated
        </p>
        <p className="mt-1 text-[0.875rem] text-ink">8 October 2026</p>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            By using Wetin Dey you agree
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>You are at least 17 years old.</li>
            <li>
              You will not publish content that is knowingly false,
              defamatory, threatening, harassing, or that incites violence.
            </li>
            <li>
              You will not publish another person&apos;s private information
              (phone numbers, home addresses, financial details) with intent to
              harm.
            </li>
            <li>
              You will not publish content that promotes hatred of any ethnic,
              religious, or political group.
            </li>
            <li>
              You will not impersonate another person, a government official,
              or a public agency.
            </li>
            <li>
              You accept that reports you submit become part of a permanent
              public archive, except where they violate our content rules (see
              below), in which case they are removed from public view within 24
              hours.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Content that is not allowed
          </h2>
          <p className="mb-2 text-[0.875rem] text-muted">
            Content that violates this list is removed from public view within
            24 hours. Abusive users are ejected. Repeated violations result in
            a permanent ban.
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Threats of violence against any person or group</li>
            <li>
              Doxxing — publishing someone&apos;s private contact info or home
              address
            </li>
            <li>Any content naming a person under 18 years old</li>
            <li>Sexual content involving minors</li>
            <li>
              Content promoting hatred of any ethnic, religious, or political
              group
            </li>
            <li>
              Impersonation of a government agency, official, or another user
            </li>
            <li>Spam, scams, or fraudulent offers</li>
            <li>
              Deliberate misinformation known to be false at time of posting
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Religion and politics
          </h2>
          <p>
            Wetin Dey does not allow attacks on any religion. Sharing personal
            spiritual expression — testimony, prayer, faith practice — is
            allowed and protected. Stoking religious conflict is not.
          </p>
          <p className="mt-2">
            Political criticism of public officials acting in their official
            capacity is allowed. Party slogans, tribal attacks, and calls to
            violence are not.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What Wetin Dey may do
          </h2>
          <p>Wetin Dey may:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1.5">
            <li>
              Label any content <strong>Disputed</strong>.
            </li>
            <li>Publish a verified rebuttal alongside a report.</li>
            <li>
              Remove content from public view (within 24 hours) that names a
              minor, is a threat, is doxxing, is hate speech, or is illegal
              under Nigerian law.
            </li>
            <li>
              Permanently ban a session from posting after repeated violations.
            </li>
          </ul>
          <p className="mt-2">
            Wetin Dey will <strong>not</strong> remove content merely because
            it criticizes a public agency or a public official acting in their
            official capacity.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Report retention
          </h2>
          <p>
            Reports are not deleted. They are published at a permanent,
            timestamped URL and remain publicly accessible at that URL forever
            — <strong>unless they violate the content rules above</strong>. In
            that case, they are removed from public view within 24 hours and
            never shown to the public again. The underlying record is
            preserved in our internal records for legal and audit purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Contact
          </h2>
          <p>
            Questions:{" "}
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
            the Cybercrimes Act 2015 and Nigerian defamation law. It is not
            legal advice.
          </p>
        </div>
      </article>
    </main>
  );
}