import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const db = createServiceClient();

  const { count: reports } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("session_id", profile.id);

  const { count: comments } = await db
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("session_id", profile.id);

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
          Your data
        </h1>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.7rem] text-faint">
            We hold about you
          </p>
          <ul className="mt-3 space-y-2 text-[0.875rem] text-ink">
            <li className="flex justify-between">
              <span>Reports posted</span>
              <span className="font-mono">{reports ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span>Comments</span>
              <span className="font-mono">{comments ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span>Email</span>
              <span className="font-mono">
                {profile.email ? "1" : "0"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>IP addresses</span>
              <span className="font-mono">0</span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.9375rem] font-semibold text-ink">
            Request a copy of your data
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            We will email you a JSON file with everything tied to your account.
            Takes up to 7 days.
          </p>
          <a
            href="mailto:support@wetindey.app?subject=Data export request"
            className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-brand-soft"
          >
            Request export
          </a>
        </div>

        <Link
          href="/settings/delete"
          className="block rounded-2xl border border-danger/30 bg-danger-soft/40 px-4 py-4 transition-colors hover:bg-danger-soft"
        >
          <p className="text-[0.9375rem] font-medium text-danger">
            Delete account
          </p>
          <p className="text-[0.75rem] text-danger/80">
            Permanently removes your account and personal info
          </p>
        </Link>
      </div>
    </main>
  );
}