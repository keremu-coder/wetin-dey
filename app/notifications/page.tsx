import Link from "next/link";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { NotificationsList } from "./NotificationsList";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  actor_id: string | null;
  kind: string;
  target_type: string;
  target_id: string;
  preview: string | null;
  created_at: string;
  read_at: string | null;
  actor_handle: string | null;
};

export default async function NotificationsPage() {
  const sessionId = await getSessionId();

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-widest text-faint transition-colors hover:text-accent"
        >
          ← Back to feed
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2.5rem]">🔔</div>
          <p className="mt-3 font-serif text-[1.15rem] font-semibold text-ink">
            Sign in to see your notifications
          </p>
          <p className="mt-2 text-[0.875rem] text-muted">
            Mentions, replies, and comments land here.
          </p>
        </div>
      </main>
    );
  }

  const db = createServiceClient();

  const { data: rows } = await db
    .from("notifications")
    .select(
      "id, actor_id, kind, target_type, target_id, preview, created_at, read_at"
    )
    .eq("recipient_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);

  const list = (rows ?? []) as Omit<Row, "actor_handle">[];

  const actorIds = Array.from(
    new Set(list.map((r) => r.actor_id).filter((id): id is string => !!id))
  );

  const handleMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: sessions } = await db
      .from("sessions")
      .select("id, handle")
      .in("id", actorIds);
    for (const s of sessions ?? []) {
      handleMap.set(s.id, s.handle);
    }
  }

  const items: Row[] = list.map((r) => ({
    ...r,
    actor_handle: r.actor_id ? handleMap.get(r.actor_id) ?? null : null
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-widest text-faint transition-colors hover:text-accent"
      >
        ← Back to feed
      </Link>

      <div className="mt-4 mb-5">
        <h1 className="font-serif text-[1.85rem] font-semibold leading-tight text-ink">
          Notifications
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Replies, mentions, and comments on your reports.
        </p>
      </div>

      <NotificationsList initialItems={items} />
    </main>
  );
}