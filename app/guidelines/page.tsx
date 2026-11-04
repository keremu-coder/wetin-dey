import Link from "next/link";

export const metadata = {
  title: "Community Guidelines — Wetin Dey"
};

export default function GuidelinesPage() {
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
          Community Guidelines
        </h1>
      </div>

      <div className="mb-6 rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
        <p className="text-[0.875rem] leading-relaxed text-ink">
          <strong className="font-semibold">Zero tolerance for abuse.</strong>{" "}
          Content that violates these guidelines is removed from public view
          within 24 hours. Abusive users are ejected. Repeated violations
          result in a permanent ban.
        </p>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <p>
          Wetin Dey is a place for Nigerians to report civic problems and talk
          freely. The rules below keep it useful and keep people safe. They
          apply to reports, comments, chat messages, and community posts.
        </p>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Report well
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Be specific.</strong> Where, when, who, what happened.
              Vague reports help nobody.
            </li>
            <li>
              <strong>Bring evidence.</strong> Talk Am reports require a photo,
              video, audio, voice note, or link. No evidence, no publish.
            </li>
            <li>
              <strong>Report what you saw or experienced.</strong> Not what you
              heard from someone who heard from someone.
            </li>
            <li>
              <strong>One problem, one report.</strong> Don&apos;t bundle five
              complaints into one submission.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Do not post
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Threats of violence against any person or group</li>
            <li>
              Someone&apos;s private info — phone number, home address,
              financial details
            </li>
            <li>Anything naming a person under 18 years old</li>
            <li>Sexual content involving minors</li>
            <li>
              Attacks on any ethnic, religious, or political group
            </li>
            <li>Impersonation of a person, agency, or official</li>
            <li>Spam, scams, or fraudulent offers</li>
            <li>Content you know is false when you post it</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Religion and politics
          </h2>
          <p>
            Personal spiritual expression — testimony, prayer, faith practice —
            is welcome and protected. Attacks on any religion are not.
          </p>
          <p className="mt-2">
            Criticism of public officials acting in their official capacity is
            welcome. Party slogans, tribal attacks, and calls to violence are
            not.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            How moderation works
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Content that violates these rules is removed within 24
              hours.</strong> This includes threats, doxxing, hate speech,
              sexual content, content naming minors, illegal content, and
              confirmed defamation.
            </li>
            <li>
              <strong>Abusive users are ejected.</strong> Repeated violations
              result in a permanent ban from posting.
            </li>
            <li>
              <strong>Reports that do not violate the rules are not deleted.</strong>{" "}
              If a report is contested or false, it gets labelled{" "}
              <strong>Disputed</strong> — visible to every reader.
            </li>
            <li>
              <strong>We don&apos;t have AI with ban or delete authority.</strong>{" "}
              Humans review. AI only formalizes text into summaries.
            </li>
            <li>
              <strong>Verified rebuttals are published.</strong> If you&apos;re
              named in a report and respond with evidence, your reply appears
              attached to the report.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Anonymity
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              No phone number. No email. Our application does not log IP addresses for anonymous reports.
            </li>
            <li>
              If you add an email or phone for account recovery, that stays
              optional and removable at any time.
            </li>
            <li>
              EXIF metadata (GPS, camera model, timestamp) is stripped from
              every upload before storage.
            </li>
            <li>
              Your anonymous reports are not linked to your social posts in
              this version.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            If you are named in a report
          </h2>
          <p>
            Open the report page and submit a dispute via the{" "}
            <Link href="/takedown" className="text-brand underline">
              takedown form
            </Link>
            . If your response is verified, it appears attached to the report
            so every reader sees both sides.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Report abuse
          </h2>
          <p>
            Use the <strong>flag</strong> button on any post, comment, or
            message. A moderator reviews every flag. For urgent safety issues,
            email{" "}
            <a
              href="mailto:support@wetindey.app?subject=URGENT"
              className="text-brand underline"
            >
              support@wetindey.app
            </a>{" "}
            with subject <strong>&ldquo;URGENT&rdquo;</strong>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Full policies
          </h2>
          <p>
            See the{" "}
            <Link href="/terms" className="text-brand underline">
              Terms of Use
            </Link>
            ,{" "}
            <Link href="/privacy" className="text-brand underline">
              Privacy Policy
            </Link>
            ,{" "}
            <Link href="/disclaimer" className="text-brand underline">
              Disclaimer
            </Link>
            , and{" "}
            <Link href="/takedown" className="text-brand underline">
              Takedown &amp; Dispute
            </Link>{" "}
            pages for the full legal text.
          </p>
        </section>

        <div className="rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
          <p className="text-[0.8125rem] leading-relaxed text-ink">
            This policy has been prepared for publication and is the current version.
            For legal questions, contact <a href="mailto:support@wetindey.app" className="text-brand underline">support@wetindey.app</a>.
          </p>
        </div>
      </article>
    </main>
  );
}
