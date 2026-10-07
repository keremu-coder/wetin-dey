import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { StatusEditor } from "@/components/StatusEditor";
import { RecoveryCodeCard } from "@/components/RecoveryCodeCard";
import { UserAvatarUploader } from "@/components/UserAvatarUploader";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

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

      <div className="space-y-4">
        {/* Your picture */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <UserAvatarUploader currentAvatarUrl={avatarUrl} />
        </div>

        {/* Status line */}
        <StatusEditor sessionId={profile.id} />

        {/* Recovery code */}
        <RecoveryCodeCard />

        {/* Handle */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
            Your handle
          </p>
          <p className="mt-1 text-[1.1rem] font-semibold text-ink">
            @{profile.handle}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {profile.handle_kind === "named"
              ? "Named account — your posts show this handle publicly."
              : "Anonymous account — nobody can see who you are."}
          </p>
          <Link
            href={`/u/${encodeURIComponent(profile.handle)}`}
            className="mt-3 inline-block text-[0.8125rem] font-medium text-accent hover:underline"
          >
            View public profile →
          </Link>
        </div>

        {/* Email */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
            Email
          </p>
          <p className="mt-1 text-[1rem] font-medium text-ink">
            {profile.email || "No email attached"}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Used only for account recovery and important notifications. Never
            shown publicly.
          </p>
        </div>

        {/* Account type */}
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
        Need to change your email or handle? Contact{" "}
        <a
          href="mailto:support@wetindey.app"
          className="underline hover:text-accent"
        >
          support@wetindey.app
        </a>
        . Self-service editing is coming soon.
      </p>
    </main>
  );
}