import Link from "next/link";

export const metadata = {
  title: "Delete your account — Wetin Dey"
};

export default function DeleteAccountPublicPage() {
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
          Delete your account
        </h1>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <p>
          You can delete your Wetin Dey account at any time. This page
          explains what happens when you do, and how to request deletion if
          you no longer have access to your account.
        </p>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            If you still have access to the app
          </h2>
          <ol className="ml-5 list-decimal space-y-1.5">
            <li>Open Wetin Dey.</li>
            <li>
              Go to <strong>Settings</strong> → <strong>Delete account</strong>.
            </li>
            <li>
              Type <strong>DELETE</strong> in the confirmation field and press
              the delete button.
            </li>
            <li>
              You will be logged out and your account will be removed.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What gets deleted immediately
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Your email address and phone number (if you added one)</li>
            <li>Your Supabase sign-in record</li>
            <li>
              Your handle is deactivated and freed for reuse
            </li>
            <li>
              Your avatar and any Space avatars you uploaded as an owner
            </li>
            <li>Your voice broadcasts and their audio files</li>
            <li>Your followers, following, and blocks</li>
            <li>
              Your push notification subscriptions (browser and native)
            </li>
            <li>
              Your check-ins, daily answers, Radar signals, and profile status
            </li>
            <li>Your reaction history and votes</li>
            <li>
              If you tick <strong>Also delete my chat messages</strong>, your
              community chat messages are deleted too
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What stays, but is detached from you
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Your reports and comments</strong> stay visible in the
              archive, but we replace your session id and handle with a
              placeholder. They can no longer be linked to you. This is a
              deliberate policy — reports are permanent records and removing
              them would break the integrity of the public archive.
            </li>
            <li>
              <strong>Your direct messages</strong> stay visible to the other
              participant, because deleting them would erase their copy of the
              conversation too. Their sender id points to a ghost profile with
              no email, no login, and a generic handle — it cannot be logged
              into again.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            If you no longer have access to the app
          </h2>
          <p>
            Email{" "}
            <a
              href="mailto:support@wetindey.app?subject=Delete%20my%20account"
              className="text-accent underline"
            >
              support@wetindey.app
            </a>{" "}
            with subject <strong>&ldquo;Delete my account&rdquo;</strong> and
            include:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1.5">
            <li>Your handle (the @name shown on your profile)</li>
            <li>
              The email address or phone number you added to the account, if
              any
            </li>
            <li>
              Your recovery code, if you saved it (this is the code you were
              shown when you first joined)
            </li>
          </ul>
          <p className="mt-2">
            We will verify ownership and complete the deletion within 7
            working days. You will receive a confirmation email when done.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Data retention
          </h2>
          <p>
            After deletion, we keep no email address, phone number, or handle
            linked to your account. See the{" "}
            <Link href="/privacy" className="text-accent underline">
              Privacy Policy
            </Link>{" "}
            for full details on what we do and do not retain.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            Questions
          </h2>
          <p>
            Contact{" "}
            <a
              href="mailto:support@wetindey.app"
              className="text-accent underline"
            >
              support@wetindey.app
            </a>
            . We respond within 48 hours.
          </p>
        </section>
      </article>
    </main>
  );
}