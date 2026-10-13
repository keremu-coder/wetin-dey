import Link from "next/link";
import { Alama } from "@/components/Alama";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getCurrentProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { MeTabs } from "@/components/MeTabs";

export const dynamic = "force-dynamic";

type MeData = {
  memberships: Array<{ community_id: string; role: string; joined_at: string }>;
  posts: Array<{
    id: string;
    agency_canonical: string | null;
    agency_raw: string | null;
    summary_pidgin: string | null;
    body: string | null;
    created_at: string;
    post_type: string | null;
    community_id: string | null;
  }>;
  postCount: number;
  spaces: Array<{
    id: string;
    slug: string;
    name: string;
    emoji: string;
    avatar_url: string | null;
    member_count: number;
    post_count: number;
    is_public: boolean;
    role: string;
  }>;
};

async function getMeDataInner(sessionId: string): Promise<MeData> {
  const db = createServiceClient();

  const [membershipsResult, reportsResult, postCountResult] = await Promise.all([
    db
      .from("community_members")
      .select("community_id, role, joined_at")
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: false }),
    db
      .from("reports")
      .select(
        "id, agency_canonical, agency_raw, summary_pidgin, body, created_at, post_type, community_id"
      )
      .eq("session_id", sessionId)
      .is("community_id", null)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .is("community_id", null)
  ]);

  const memberships = (membershipsResult.data ?? []) as MeData["memberships"];
  const posts = (reportsResult.data ?? []) as MeData["posts"];
  const postCount = postCountResult.count ?? 0;

  const communityIds = memberships.map((m) => m.community_id);
  const roleMap = new Map(memberships.map((m) => [m.community_id, m.role]));

  let spaces: MeData["spaces"] = [];
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

  return { memberships, posts, postCount, spaces };
}

const getMeData = unstable_cache(getMeDataInner, ["me-data-v1"], {
  revalidate: 15
});

export default async function MePage(props: {

    searchParams: Promise<{ tab?: string }>;

}) {
  const searchParams = await props.searchParams;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const initialTab = searchParams.tab === "posts" ? "posts" : "spaces";
  const { posts, postCount, spaces } = await getMeData(profile.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Alama seed={profile.id} size={64} title={`@${profile.handle}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[1.35rem] font-semibold text-ink">
              @{profile.handle}
            </h1>
            <p className="text-[0.8125rem] text-muted">
              {profile.handle_kind === "named" ? "Named account" : "Anonymous"}
            </p>
          </div>
          <Link
            href={`/u/${encodeURIComponent(profile.handle)}`}
            className="shrink-0 rounded-xl border border-border-strong bg-paper px-3 py-1.5 text-[0.75rem] font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Public view
          </Link>
        </div>
      </div>

      <MeTabs
        spaces={spaces}
        posts={posts}
        postCount={postCount}
        initialTab={initialTab}
      />

      <div className="mt-8 text-center">
        <Link
          href="/settings"
          className="text-[0.8125rem] font-medium text-brand hover:underline"
        >
          Settings →
        </Link>
      </div>
    </main>
  );
}