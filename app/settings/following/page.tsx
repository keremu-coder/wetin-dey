import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const db = createServiceClient();

  const { data: follows } = await db
    .from("follows")
    .select("followed_session_id, created_at")
    .eq("follower_session_id", profile.id)
    .order("created_at", { ascending: false });

  const ids = (follows ?? []).map((f) => f.followed_session_id);
  let people: { id: string; handle: string; handle_kind: string }[] = [];

  if (ids.length > 0) {
    const { data } = await db
      .from("sessions")
      .select("id, handle, handle_kind")
      .in("id", ids);
    people = data ?? [];
  }

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
          Following
        </h1>
      </div>

      {people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <p className="text-[0.9375rem] text-ink">
            You aren't following anyone yet.
          </p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white"
          >
            Find people
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {people.map((p, i) => (
            <Link
              key={p.id}
              href={`/u/${encodeURIComponent(p.handle)}`}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/5 ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-[1.05rem] font-semibold text-white">
                {p.handle.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium text-ink">
                  @{p.handle}
                </p>
                <p className="text-[0.75rem] capitalize text-muted">
                  {p.handle_kind}
                </p>
              </div>
              <span className="text-faint">›</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}