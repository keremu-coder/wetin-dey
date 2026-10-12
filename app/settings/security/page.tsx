import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
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
          Security
        </h1>
      </div>

      <div className="space-y-3">
        <Link
          href="/forgot-password"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 transition-colors hover:bg-ink/5"
        >
          <span className="text-[1.25rem] text-warm-deep">🔑</span>
          <div className="flex-1">
            <p className="text-[0.9375rem] font-medium text-ink">
              Change password
            </p>
            <p className="text-[0.75rem] text-muted">
              We send a reset link to {profile.email || "your email"}
            </p>
          </div>
          <span className="text-faint">›</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-[1.25rem] text-warm-deep">📱</span>
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-faint">
              Soon
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-[1.25rem] text-warm-deep">💻</span>
            <div className="flex-1">
              <p className="text-[0.9375rem] font-medium text-ink">
                Active sessions
              </p>
              <p className="text-[0.75rem] text-muted">
                We do not track device sessions. You can sign out on any device.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-8 text-[0.75rem] text-faint">
        If you suspect someone has access to your account, change your password
        immediately and contact{" "}
        <a href="mailto:support@wetindey.app" className="underline hover:text-brand">
          support@wetindey.app
        </a>
        .
      </p>
    </main>
  );
}
