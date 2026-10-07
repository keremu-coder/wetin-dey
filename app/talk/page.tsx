import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { TalkTabs } from "@/components/TalkTabs";
import { PAGE_SIZE } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export default async function TalkAmPage({
  searchParams
}: {
  searchParams: {
    tab?: string;
    page?: string;
    state?: string;
    category?: string;
    agency?: string;
    status?: string;
  };
}) {
  const rawTab = (searchParams.tab ?? "civic").toLowerCase();

  // Legacy: /talk?tab=live now lives at /radar
  if (rawTab === "live") {
    redirect("/radar");
  }

  const initialTab: Tab = rawTab === "community" ? "community" : "civic";
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const [sessionId, reviewedCount] = await Promise.all([
    getSessionId(),
    getReviewedCount()
  ]);

  const db = createServiceClient();
  const allowUnreviewed = reviewedCount < 5;

  // Build both queries and run them in parallel.
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

  let communityQ = db
    .from("reports")
    .select("*")
    .in("post_type", COMMUNITY_TYPES)
    .is("community_id", null)
    .eq("held", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (searchParams.state) communityQ = communityQ.eq("state", searchParams.state);

  const [meResult, civicResult, communityResult] = await Promise.all([
    sessionId
      ? db.from("sessions").select("handle").eq("id", sessionId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    civicQ,
    communityQ
  ]);

  const currentHandle = meResult.data?.handle ?? null;

  const civicReports = ((civicResult.data ?? []) as Report[])
    .filter(
      (r) => r.reviewed || allowUnreviewed || r.session_id === sessionId
    )
    .map((r) => stripSession(r) as Report);

  const communityReports = ((communityResult.data ?? []) as Report[]).map(
    (r) => stripSession(r) as Report
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <TalkTabs
        civicReports={civicReports}
        communityReports={communityReports}
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

      <Link
        href={initialTab === "community" ? "/submit?tab=community" : "/submit?tab=talk"}
        className="mt-10 flex min-h-[52px] items-center justify-center rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-accent-deep hover:shadow-card"
      >
        {initialTab === "community"
          ? "Post to Community"
          : "Report Wetin Happen"}
      </Link>
    </main>
  );
}