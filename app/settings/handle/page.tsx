import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { HandleEditor } from "@/components/HandleEditor";

export const dynamic = "force-dynamic";

export default async function HandleSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings/account"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Edit handle
        </h1>
      </div>

      <HandleEditor initialHandle={profile.handle} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
          About handles
        </p>
        <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-muted">
          <li>
            <strong className="text-ink">One change per 30 days.</strong> This
            prevents impersonation and handle squatting.
          </li>
          <li>
            <strong className="text-ink">Old links keep working.</strong> If
            someone visits your old handle URL, they still find you.
          </li>
          <li>
            <strong className="text-ink">Old handles are retired.</strong> Once
            you move on, nobody else can take your old name.
          </li>
          <li>
            <strong className="text-ink">Your posts stay yours.</strong> All
            your past reports and comments update to show the new handle.
          </li>
        </ul>
      </div>
    </main>
  );
}