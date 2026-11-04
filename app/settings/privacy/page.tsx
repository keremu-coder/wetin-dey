import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Privacy
        </h1>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.9375rem] font-semibold text-ink">
            What we collect
          </p>
          <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-muted">
            <li>• Anonymous reports: nothing. Our application does not log IP addresses. No phone. No email.</li>
            <li>• Named accounts: email and a hashed password, so you can sign in.</li>
            <li>• Uploaded photos: EXIF/GPS metadata stripped before upload.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.9375rem] font-semibold text-ink">
            What we never collect
          </p>
          <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-muted">
            <li>• No IP addresses logged by our application for anonymous reports</li>
            <li>• No phone numbers</li>
            <li>• No device fingerprints</li>
            <li>• No third-party analytics</li>
            <li>• Reports and posts use rough state-level location only, never stored. Radar Need help / Police stop signals share exact coordinates, but only with the Circle members you chose, and only while the signal is active (up to 4 hours). Coordinates are cleared the moment you tap I&apos;m safe or the signal auto-expires.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.9375rem] font-semibold text-ink">
            Who sees your posts
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            Everything you post is public and permanently citable. If you post
            anonymously, your handle is not shown. If you post as a named
            account, your @{profile.handle} appears on the post.
          </p>
        </div>

        <Link
          href="/privacy"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 transition-colors hover:bg-ink/5"
        >
          <span className="text-[1.25rem] text-warm-deep">📄</span>
          <div className="flex-1">
            <p className="text-[0.9375rem] font-medium text-ink">
              Read the full privacy policy
            </p>
          </div>
          <span className="text-faint">›</span>
        </Link>
      </div>
    </main>
  );
}