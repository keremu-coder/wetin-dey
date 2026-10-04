import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <p className="font-mono text-[0.7rem] uppercase tracking-widest text-faint">
          Settings
        </p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-tight text-ink">
          Your account
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Signed in as <strong className="text-ink">@{profile.handle}</strong>
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/settings/blocked"
          className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div>
            <p className="text-[1rem] font-semibold text-ink">Blocked users</p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Manage who you no wan see or hear from
            </p>
          </div>
          <span className="text-faint">→</span>
        </Link>

        <Link
          href="/support"
          className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div>
            <p className="text-[1rem] font-semibold text-ink">Contact support</p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Report a problem, appeal a moderation action
            </p>
          </div>
          <span className="text-faint">→</span>
        </Link>

        <Link
          href="/settings/delete"
          className="flex items-center justify-between rounded-2xl border border-danger/30 bg-danger-soft/40 p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
        >
          <div>
            <p className="text-[1rem] font-semibold text-danger">
              Delete account
            </p>
            <p className="mt-1 text-[0.8125rem] text-danger/80">
              Permanently remove your account and personal info
            </p>
          </div>
          <span className="text-danger">→</span>
        </Link>
      </div>

      <p className="mt-8 text-[0.75rem] text-faint">
        Wetin Dey is for users 17 and older. Review our{" "}
        <Link href="/terms" className="underline hover:text-accent">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="underline hover:text-accent">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/guidelines" className="underline hover:text-accent">
          Community Guidelines
        </Link>
        .
      </p>
    </main>
  );
}