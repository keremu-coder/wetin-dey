import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { PresenceToggle } from "@/components/PresenceToggle";

export const dynamic = "force-dynamic";

export default async function PresenceSettingsPage() {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/signin");

  const db = createServiceClient();
  const { data: me } = await db
    .from("sessions")
    .select("hide_presence")
    .eq("id", sessionId)
    .maybeSingle();

  const initial = me?.hide_presence === true;

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
          Presence
        </h1>
      </div>

      <PresenceToggle initial={initial} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="text-[0.7rem] text-faint">
          How it works
        </p>
        <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Reciprocal.</strong> Hiding your
            presence is a two-way trade. You stop showing your online / away /
            offline dot, and you also stop seeing other people&apos;s dots.
            This is deliberate — you can&apos;t lurk while others are visible.
          </li>
          <li>
            <strong className="text-ink">Applies everywhere.</strong> Space
            chat, member lists, DM threads, profile pages.
          </li>
          <li>
            <strong className="text-ink">Your last activity stays private.</strong>{" "}
            We still record it internally so the app works, but it never leaves
            our servers when this is on.
          </li>
          <li>
            <strong className="text-ink">You can switch back anytime.</strong>{" "}
            Turning it off restores normal presence behavior instantly.
          </li>
        </ul>
      </div>
    </main>
  );
}