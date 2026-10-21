import Link from "next/link";
import { Suspense } from "react";
import { WetinMark } from "@/components/WetinMark";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { TalkTabs } from "@/components/TalkTabs";
import { PAGE_SIZE } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/lib/blocks";
import { stripSession, type Report } from "@/lib/types";

const TALK_AM_TYPES = ["report_am", "ask", "help"];
const COMMUNITY_TYPES = ["talk_am", "news", "talent", "rant"];

const getReviewedCount = unstable_cache(
  async () => {
    const db = createServiceClient();
    const { count } = await db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reviewed", true)
      .in("post_type", TALK_AM_TYPES)
      .is("community_id", null);
    return count ?? 0;
  },
  ["talk-am-reviewed-count-v1"],
  { revalidate: 30 }
);

type Tab = "civic" | "community";

type TalkSearchParams = {
  tab?: string;
  page?: string;
  state?: string;
  category?: string;
  agency?: string;
  status?: string;
};

/**
 * Skeleton shown while TalkData streams in. Mirrors the real page layout
 * so the swap from skeleton to content has no shift.
 */
function TalkSkeleton() {
  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        <div className="h-5 w-20 animate-pulse rounded bg-skeleton" />
        <div className="h-5 w-24 animate-pulse rounded bg-skeleton" />
      </div>
      <div className="mb-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-skeleton" />
        <div className="mt-2 h-3.5 w-full animate-pulse rounded bg-skeleton" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-skeleton" />
            <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-skeleton" />
            <div className="mt-2 h-3.5 w-full animate-pulse rounded bg-skeleton" />
            <div className="mt-1.5 h-3.5 w-5/6 animate-pulse rounded bg-skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Static shell â€” awaits only searchParams (~5ms) so the browser sees a
 * painted page instantly. The data-heavy <TalkData> streams in via Suspense.
 */
export default async function TalkAmPage(props: {
  searchParams: Promise<TalkSearchParams>;
}) {
  const searchParams = await props.searchParams;

  const rawTab = (searchParams.tab ?? "civic").toLowerCase();

  if (rawTab === "live") {
    redirect("/radar");
  }

  const initialTab: Tab = rawTab === "community" ? "community" : "civic";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <Suspense fallback={<TalkSkeleton />}>
        <TalkData searchParams={searchParams} initialTab={initialTab} />
      </Suspense>

      <Link
        href={
          initialTab === "community"
            ? "/submit?tab=community"
            : "/submit?tab=talk"
        }
        aria-label={
          initialTab === "community" ? "Post to Community" : "Report Wetin Happen"
        }
        className="fixed bottom-[88px] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform active:scale-95"
        style={{ background: "var(--brand-ink)", boxShadow: "var(--shadow-2)" }}
      >
        <WetinMark size={26} title="" />
      </Link>
    </main>
  );
}

async function TalkData({
  searchParams,
  initialTab
}: {
  searchParams: TalkSearchParams;
  initialTab: Tab;
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const [sessionId, reviewedCount] = await Promise.all([
    getSessionId(),
    getReviewedCount()
  ]);

  const blockedIds = await getBlockedIds(sessionId);
  const blockedList = Array.from(blockedIds);

  const db = createServiceClient();
  const allowUnreviewed = reviewedCount < 5;

  let civicQ = db
    .from("reports")
    .select("*")
    .in("post_type", TALK_AM_TYPES)
    .is("community_id", null)
    .eq("held", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (!allowUnreviewed) {
    civicQ = civicQ.eq("reviewed", true);
  }
  if (searchParams.category) civicQ = civicQ.eq("category", searchParams.category);
  if (searchParams.agency) civicQ = civicQ.eq("agency_canonical", searchParams.agency);
  if (searchParams.status) civicQ = civicQ.eq("status", searchParams.status);
  if (searchParams.state) civicQ = civicQ.eq("state", searchParams.state);
  if (blockedList.length > 0) {
    civicQ = civicQ.not("session_id", "in", `(${blockedList.join(",")})`);
  }

  let communityQ = db
    .from("reports")
    .select("*")
    .in("post_type", COMMUNITY_TYPES)
    .is("community_id", null)
    .eq("held", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (searchParams.state) communityQ = communityQ.eq("state", searchParams.state);
  if (blockedList.length > 0) {
    communityQ = communityQ.not("session_id", "in", `(${blockedList.join(",")})`);
  }

  const [meResult, civicResult, communityResult] = await Promise.all([
    sessionId
      ? db.from("sessions").select("handle").eq("id", sessionId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    civicQ,
    communityQ
  ]);

  const currentHandle = meResult.data?.handle ?? null;

  const rawCivic = ((civicResult.data ?? []) as Report[])
    .filter(
      (r) => r.reviewed || allowUnreviewed || r.session_id === sessionId
    );

  const rawComm = ((communityResult.data ?? []) as Report[]);

  const allSessIds = Array.from(new Set([...rawCivic, ...rawComm].map(r => r.session_id).filter(Boolean)));
  const sessionMap = new Map();
  if (allSessIds.length > 0) {
    const { data: profiles } = await db.from("sessions").select("id, avatar_url, photo_visibility").in("id", allSessIds);
    for (const p of profiles ?? []) sessionMap.set(p.id, p);
  }

  const injectAvatar = (r: Report) => {
    const prof = r.session_id ? sessionMap.get(r.session_id) : null;
    return {
      ...stripSession(r) as Report,
      author_avatar_url: prof?.avatar_url || null,
      author_photo_visibility: prof?.photo_visibility || "private"
    };
  };

  const civicReports = rawCivic.map(injectAvatar);

  const communityReports = rawComm.map(injectAvatar);

  // Batch-fetch the viewer own votes so PostActions does not fire one GET per card.
  const reportIds = [...civicReports, ...communityReports].map((r) => r.id);
  if (sessionId && reportIds.length > 0) {
    const { data: voteRows } = await db
      .from("post_votes")
      .select("post_id, vote")
      .eq("session_id", sessionId)
      .in("post_id", reportIds);
    const voteMap = new Map<string, string>();
    for (const v of voteRows ?? []) voteMap.set(v.post_id, v.vote);
    const attach = (r: any) => ({ ...r, my_vote: voteMap.get(r.id) ?? null });
    civicReports.forEach((r, i) => { civicReports[i] = attach(r); });
    communityReports.forEach((r, i) => { communityReports[i] = attach(r); });
  }

  const sortResolvedFirst = (arr: Report[]): Report[] =>
    [...arr].sort((a, b) => {
      const aR = a.status === "resolved" ? 1 : 0;
      const bR = b.status === "resolved" ? 1 : 0;
      return bR - aR;
    });

  return (
    <TalkTabs
      civicReports={sortResolvedFirst(civicReports)}
      communityReports={sortResolvedFirst(communityReports)}
      civicPage={page}
      communityPage={page}
      currentHandle={currentHandle}
      filters={{
        state: searchParams.state,
        category: searchParams.category,
        agency: searchParams.agency
      }}
      initialTab={initialTab}
    />
  );
}
