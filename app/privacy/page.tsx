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
        <p className="text-[0.7rem] text-faint">
          Last updated
        </p>
        <p className="mt-1 text-[0.875rem] text-ink">8 October 2026</p>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <p>
          Wetin Dey is a community platform for anonymous civic reports from
          Nigerian citizens. This policy explains what we collect, what we do
          not, and your rights under the Nigeria Data Protection Act 2023
          (NDPA).
        </p>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What we collect
          </h2>
          <p>
            <strong>Anonymous activity:</strong> a random session identifier
            stored in a signed HTTP-only cookie. No phone number. No email
            address. Our application does not log IP addresses for anonymous reports, comments, or messages. As with any web service, our hosting and database providers process request metadata (including IP) at the network layer for security and abuse prevention.
          </p>
          <p className="mt-2">
            <strong>Optional account recovery:</strong> you may attach an email
            address or phone number to your session for recovery. This is
            optional and removable at any time. Reports you post stay anonymous
            regardless.
          </p>
          <p className="mt-2">
            <strong>Images and video:</strong> photos and videos attached to
            reports and posts, plus avatars for your profile and any Spaces you
            own. All EXIF metadata (GPS, camera model, timestamp) is stripped
            before storage.
          </p>
          <p className="mt-2">
            <strong>Audio:</strong> voice notes attached to comments and chat
            messages, and voice broadcasts posted inside Spaces.
          </p>
          <p className="mt-2">
            <strong>Your handle:</strong> the @name you choose (or the random
            one we assign). It is public and appears next to everything you
            post under a named account.
          </p>
          <p className="mt-2">
            <strong>Coarse location:</strong> when you submit a report or post
            to Talk Am, we store the state or LGA you choose. Nothing finer is
            stored for public content.
          </p>
          <p className="mt-2">
            <strong>Precise location (Radar safety signals):</strong> when you
            send a <em>Need help</em> or <em>Police stop</em> signal on Radar,
            your device sends precise coordinates. Those coordinates are
            visible only to the Circle members you selected for that signal.
            They are never shown on any public page. While the signal is
            active, your device sends an updated location every 30 seconds.
            The moment you tap <strong>I&apos;m safe</strong>, updates stop and
            the location is marked as no longer shared. You can also remove
            the entire signal by asking us to delete your account.
          </p>
          <p className="mt-2">
            <strong>Presence:</strong> a last-seen timestamp that powers the
            online indicator. You can hide it entirely in Settings → Presence.
          </p>
          <p className="mt-2">
            <strong>Push tokens:</strong> if you enable notifications, we store
            the push subscription your browser issues, and on Android we store
            the Firebase Cloud Messaging (FCM) device token so we can deliver
            native push. iOS native push (APNs) is on the roadmap, not yet
            shipped. You can disable notifications anytime in your device
            settings.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What we do not collect
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Phone numbers (unless you add one for recovery)</li>
            <li>Email addresses (unless you add one for recovery)</li>
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
              <strong>Supabase</strong> — database, file storage, realtime,
              authentication. EU region.
            </li>
            <li>
              <strong>Vercel</strong> — hosting, edge network, and Blob storage
              for large files. Global edge network.
            </li>
            <li>
              <strong>Groq</strong> — AI formalization of report text, and audio transcription of voice testimony attached to reports and voice comments. Report body text and the relevant audio file are sent to Groq for processing. Groq never receives session identifiers, account data, or any other uploaded files. US.
            </li>
            <li>
              <strong>Resend</strong> — sends verification and password-reset
              emails on our behalf via Supabase Auth. US.
            </li>
            <li>
              <strong>Telegram</strong> — receives a public mirror of reviewed
              reports only. No DMs, no user files.
            </li>
          </ul>
          <p className="mt-2">
            We do not sell your data. We do not run ads on the Talk Am civic
            feed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Retention
          </h2>
          <p>
            Reports and comments that comply with our content rules stay in
            the public archive, attached to a permanent URL. Content that
            violates the rules (threats, doxxing, hate, sexual content,
            minors, illegal content, confirmed defamation) is removed from
            public view within 24 hours and never shown publicly again.
          </p>
          <p className="mt-2">
            Voice notes and chat messages stay until you or a moderator deletes
            them. Broadcasts expire automatically after 24 hours.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Deleting your account
          </h2>
          <p>
            When you delete your account we remove your email, phone number,
            handle, auth record, avatars, broadcasts, followers, blocks, push
            subscriptions, check-ins, votes, reactions, and Radar signals
            immediately.
          </p>
          <p className="mt-2">
            Your reports and comments stay visible in the archive but are
            detached from your identity — we replace your session id and
            handle with a placeholder.
          </p>
          <p className="mt-2">
            <strong>
              Direct messages you sent remain visible to the other participant
            </strong>
            , because removing them would erase their copy of the conversation
            too. Their sender id points to a ghost profile with no email, no
            login, and a generic handle — it cannot be logged into again.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Your rights (NDPA)
          </h2>
          <p>Under the Nigeria Data Protection Act 2023 you can:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for optional processing</li>
          </ul>
          <p className="mt-2">
            Because reports are never deleted (see the{" "}
            <Link href="/terms" className="text-brand underline">
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
              className="text-brand underline"
            >
              support@wetindey.app
            </a>
          </p>
        </section>

        <div className="rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
          <p className="text-[0.8125rem] leading-relaxed text-ink">
            <strong>Draft notice:</strong> this copy is written in plain
            language and is pending review by a Nigerian lawyer familiar with
            the NDPA 2023 and the Cybercrimes Act 2015. It is not legal advice.
          </p>
        </div>
      </article>
    </main>
  );
}
