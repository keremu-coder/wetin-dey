import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { StatusEditor } from "@/components/StatusEditor";
import { RecoveryCodeCard } from "@/components/RecoveryCodeCard";
import { UserAvatarUploader } from "@/components/UserAvatarUploader";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const db = createServiceClient();
  const { data: sessionRow } = await db
    .from("sessions")
    .select("email_verified_at")
    .eq("id", profile.id)
    .maybeSingle();

  const emailVerified = sessionRow?.email_verified_at != null;
  const hasEmail = !!profile.email;

  const avatarUrl =
    typeof (profile as { avatar_url?: string | null }).avatar_url === "string"
      ? ((profile as { avatar_url?: string | null }).avatar_url as string)
      : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Profile
        </h1>
      </div>

      {hasEmail && !emailVerified ? (
        <div className="mb-4 rounded-2xl border border-gold/40 bg-gold-soft/50 p-4">
          <p className="text-[0.9375rem] font-semibold text-ink">
            Verify your email
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink/85">
            We sent a verification link to {profile.email}. Click it to enable
            password reset. Until then, use your recovery code if you lose
            access.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <UserAvatarUploader currentAvatarUrl={avatarUrl} />
        </div>

        <StatusEditor sessionId={profile.id} />

        <Link
          href="/settings/handle"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand/50"
        >
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
              Your handle
            </p>
            <p className="mt-1 text-[1.1rem] font-semibold text-ink">
              @{profile.handle}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Tap to edit your username. One change per 30 days.
            </p>
          </div>
          <span className="shrink-0 text-faint">›</span>
        </Link>

        <RecoveryCodeCard />

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
            Email
          </p>
          <p className="mt-1 text-[1rem] font-medium text-ink">
            {profile.email || "No email attached"}
          </p>
          {hasEmail ? (
            <p className="mt-1 text-[0.8125rem] text-muted">
              {emailVerified ? (
                <span className="text-brand">✓ Verified</span>
              ) : (
                <span className="text-danger">
                  Not verified — check your inbox for the link
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-[0.8125rem] text-muted">
              Optional. Used only for account recovery. Never shown publicly.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
            Account type
          </p>
          <p className="mt-1 text-[1rem] font-medium capitalize text-ink">
            {profile.handle_kind}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Anonymous accounts can upgrade to a named account anytime.
          </p>
        </div>
      </div>

      <p className="mt-8 text-[0.75rem] leading-relaxed text-faint">
        Need to change your email? Contact{" "}
        <a
          href="mailto:support@wetindey.app"
          className="underline hover:text-brand"
        >
          support@wetindey.app
        </a>
        .
      </p>
    </main>
  );
}