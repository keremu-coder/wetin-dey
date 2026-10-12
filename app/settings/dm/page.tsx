import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { DMPolicyForm } from "@/components/DMPolicyForm";

export const dynamic = "force-dynamic";

export default async function DMSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const policy =
    (profile as { dm_policy?: string | null }).dm_policy === "following"
      ? "following"
      : "everyone";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings/privacy"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Direct messages
        </h1>
      </div>

      <DMPolicyForm initialPolicy={policy} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
          How DMs work
        </p>
        <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Private.</strong> Only you and the
            other person see the messages. Nobody else.
          </li>
          <li>
            <strong className="text-ink">Contact-info filtered.</strong> Phone
            numbers, emails, and links to other apps are blocked. That protects
            you from scams that push off-platform.
          </li>
          <li>
            <strong className="text-ink">Blocked users can&apos;t message.</strong>{" "}
            If you block someone (or they block you), DMs between you stop
            working both ways. You can manage blocks in{" "}
            <Link href="/settings/blocked" className="text-brand underline">
              Settings → Blocked users
            </Link>
            .
          </li>
          <li>
            <strong className="text-ink">Existing conversations stay open.</strong>{" "}
            If you switch to &ldquo;Only people I follow&rdquo;, threads you
            already have keep working. It only affects new people trying to
            start a conversation.
          </li>
        </ul>
      </div>
    </main>
  );
}