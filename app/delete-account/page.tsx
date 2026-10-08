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
            What gets deleted
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Your email address and phone number (if you added one)</li>
            <li>Your handle is deactivated and freed for reuse</li>
            <li>Your followers, following, and blocks are removed</li>
            <li>Your push notification subscriptions are removed</li>
            <li>
              If you tick <strong>Delete my content too</strong>, your comments
              and community chat messages are deleted
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">
            What stays
          </h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              Your civic reports stay in the archive, detached from your
              handle. This is a deliberate policy — reports are permanent
              records, and removing them would break the integrity of the
              public archive.
            </li>
            <li>
              Your direct messages stay visible to the other person. Deleting
              them would remove the conversation from their account too.
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
            for details on what we do and do not retain.
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