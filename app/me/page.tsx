import Link from "next/link";
import { Suspense } from "react";
import { Alama } from "@/components/Alama";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { MeTabs } from "@/components/MeTabs";

function MeSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-skeleton" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-skeleton" />
          <div className="h-3.5 w-24 animate-pulse rounded bg-skeleton" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}

export default async function MePage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");
  const initialTab = searchParams.tab === "posts" ? "posts" : "spaces";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="relative mb-6 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-paper">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Alama seed={profile.id} size={64} title={`@${profile.handle}`} />
            )}
          </div>
          <div className="min-w-0 flex-1 pr-16">
            <h1 className="font-serif text-[1.35rem] font-semibold text-ink truncate">
              @{profile.handle}
            </h1>
            <p className="text-[0.8125rem] text-muted">
              {profile.handle_kind === "named" ? "Named account" : "Anonymous"}
            </p>
          </div>
        </div>
        <Link
          href={`/u/${encodeURIComponent(profile.handle)}`}
          className="absolute right-4 top-4 rounded-xl border border-border-strong bg-paper px-3 py-1.5 text-[0.75rem] font-medium text-ink transition-colors hover:bg-ink/5"
        >
          Public view
        </Link>
      </div>

      <Suspense fallback={<MeSkeleton />}>
        <MeData profileId={profile.id} initialTab={initialTab} />
      </Suspense>

      <div className="mt-8 text-center">
        <Link
          href="/settings"
          className="text-[0.8125rem] font-medium text-brand hover:underline"
        >
          Settings â†’
        </Link>
      </div>
    </main>
  );
}

async function MeData({
  profileId,
  initialTab
}: {
  profileId: string;
  initialTab: "spaces" | "posts";
}) {
  const db = createServiceClient();

  const [membershipsResult, reportsResult, postCountResult] =
    await Promise.all([
      db
        .from("community_members")
        .select("community_id, role, joined_at")
        .eq("session_id", profileId)
        .order("joined_at", { ascending: false }),
      db
        .from("reports")
        .select(
          "id, agency_canonical, agency_raw, summary_pidgin, body, created_at, post_type, community_id"
        )
        .eq("session_id", profileId)
        .is("community_id", null)
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("session_id", profileId)
        .is("community_id", null)
    ]);

  const memberships = membershipsResult.data ?? [];
  const posts = (reportsResult.data ?? []) as Array<{
    id: string;
    agency_canonical: string | null;
    agency_raw: string | null;
    summary_pidgin: string | null;
    body: string | null;
    created_at: string;
    post_type: string | null;
    community_id: string | null;
  }>;
  const postCount = postCountResult.count ?? 0;

  const communityIds = memberships.map((m) => m.community_id);
  const roleMap = new Map(memberships.map((m) => [m.community_id, m.role]));

  let spaces: {
    id: string;
    slug: string;
    name: string;
    emoji: string;
    avatar_url: string | null;
    member_count: number;
    post_count: number;
    is_public: boolean;
    role: string;
  }[] = [];

  if (communityIds.length > 0) {
    const { data: communities } = await db
      .from("communities")
      .select(
        "id, slug, name, emoji, avatar_url, member_count, post_count, is_public"
      )
      .in("id", communityIds);

    spaces = (communities ?? []).map((c) => ({
      ...c,
      role: (roleMap.get(c.id) as string) ?? "member"
    }));
  }

  return (
    <MeTabs spaces={spaces} posts={posts} postCount={postCount} initialTab={initialTab} />
  );
}
