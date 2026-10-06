import Link from "next/link";
import { unstable_cache } from "next/cache";
import { HomeFeed } from "@/components/ReportCard";
import { PAGE_SIZE } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";

export const dynamic = "force-dynamic";

const TALK_AM_TYPES = ["report_am", "ask", "help"];

// Cache the reviewed count for 30s. Without this, every home visit runs
// a count(*) over the whole reports table — expensive at scale.
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

export default async function HomePage({
  searchParams
}: {
  searchParams: {
    page?: string;
    state?: string;
    category?: string;
    agency?: string;
    status?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  // These two are independent — run in parallel.
  const [sessionId, reviewedCount] = await Promise.all([
    getSessionId(),
    getReviewedCount()
  ]);

  const db = createServiceClient();
  const allowUnreviewed = reviewedCount < 5;

  // Build the reports query and the "who am I" lookup in parallel.
  let q = db
    .from("reports")
    .select("*")
    .in("post_type", TALK_AM_TYPES)
    .is("community_id", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (!allowUnreviewed) {
    q = q.eq("reviewed", true);
  }
  if (searchParams.category) q = q.eq("category", searchParams.category);
  if (searchParams.agency) q = q.eq("agency_canonical", searchParams.agency);
  if (searchParams.status) q = q.eq("status", searchParams.status);
  if (searchParams.state) q = q.eq("state", searchParams.state);

  const [meResult, reportsResult] = await Promise.all([
    sessionId
      ? db.from("sessions").select("handle").eq("id", sessionId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    q
  ]);

  const currentHandle = meResult.data?.handle ?? null;

  const reports = ((reportsResult.data ?? []) as Report[])
    .filter((r) => r.reviewed || allowUnreviewed || r.session_id === sessionId)
    .map((r) => stripSession(r) as Report);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex gap-2 border-b border-border">
        <Link
          href="/"
          className="border-b-2 border-accent px-4 py-3 font-serif text-[1.05rem] font-semibold text-ink"
        >
          Talk Am
        </Link>
        <Link
          href="/community"
          className="border-b-2 border-transparent px-4 py-3 font-serif text-[1.05rem] font-semibold text-muted transition-colors hover:text-ink"
        >
          Community
        </Link>
        <Link
          href="/communities"
          className="border-b-2 border-transparent px-4 py-3 font-serif text-[1.05rem] font-semibold text-muted transition-colors hover:text-ink"
        >
          Spaces
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">
          Talk Am
        </h1>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
          Civic reports and accountability. Everything here requires evidence.
          Nothing gets deleted. Nothing carries ads. Ever.
        </p>
      </div>

      <HomeFeed
        reports={reports}
        page={page}
        currentHandle={currentHandle}
        filters={{
          state: searchParams.state,
          category: searchParams.category,
          agency: searchParams.agency
        }}
      />

      <Link
        href="/submit?tab=talk"
        className="mt-10 flex min-h-[52px] items-center justify-center rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-accent-deep hover:shadow-card"
      >
        Report Wetin Happen
      </Link>
    </main>
  );
}