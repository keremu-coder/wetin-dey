import Link from "next/link";

export const metadata = {
  title: "Disclaimer — Wetin Dey"
};

export default function DisclaimerPage() {
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
          Disclaimer
        </h1>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <p>
          Wetin Dey is a community platform for anonymous civic reports from
          Nigerian citizens. Reports are submitted by members of the public and
          are <strong>not independently verified by Wetin Dey</strong>.
        </p>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What a report on Wetin Dey means
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              The presence of a report on Wetin Dey is not a statement of fact
              by Wetin Dey. It is a statement made by an anonymous member of
              the public.
            </li>
            <li>
              Wetin Dey does not endorse, adopt, or confirm any claim made in
              any report, comment, or message on the platform.
            </li>
            <li>
              If you are named in a report and believe it is false, you can
              submit a dispute or a right-of-reply response.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What Wetin Dey is not
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              Not a substitute for reporting a matter to the Nigerian Police
              Force, the EFCC, the ICPC, or any other appropriate authority.
            </li>
            <li>Not legal advice.</li>
            <li>
              Not a statement made on behalf of any government agency, public
              official, or political party.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            If you are named in a report
          </h2>
          <p>
            Open the report page and click{" "}
            <strong>
              &ldquo;I&apos;m named in this report — submit a reply&rdquo;
            </strong>
            . Provide your name and a contact method. A moderator will review
            your response. If approved, it appears attached to the report so
            every reader sees both sides.
          </p>
          <p className="mt-2">
            You may also email{" "}
            <a
              href="mailto:support@wetindey.app"
              className="text-brand underline"
            >
              support@wetindey.app
            </a>{" "}
            with the report URL and the grounds for removal. Wetin Dey will not
            remove a report merely because its subject disputes it — we will
            label it <strong>Disputed</strong> and add your verified response.
          </p>
        </section>

        <div className="rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
          <p className="text-[0.8125rem] leading-relaxed text-ink">
            <strong>Draft notice:</strong> this copy is written in plain
            language and is pending review by a Nigerian lawyer. It is not
            legal advice.
          </p>
        </div>
      </article>
    </main>
  );
}