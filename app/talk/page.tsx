import Link from "next/link";
import { unstable_cache } from "next/cache";
import { HomeFeed } from "@/components/ReportCard";
import { DailyPrompt } from "@/components/DailyPrompt";
import { LiveRadarPanel } from "@/components/LiveRadarPanel";
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

type Tab = "civic" | "community" | "live";

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
  const tab: Tab =
    rawTab === "community" ? "community" : rawTab === "live" ? "live" : "civic";

  const isLive = tab === "live";
  const isCommunity = tab === "community";
  const activeTypes = isCommunity ? COMMUNITY_TYPES : TALK_AM_TYPES;
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  // Only fetch reports for civic/community tabs. Live tab has its own panel.
  if (isLive) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
        <Tabs tab={tab} />
        <div className="mb-6">
          <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">
            Live
          </h1>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
            Real-time signals from your area. NEPA status, checkpoints, floods.
            One tap to signal. Rounded to ~1 km. Nothing precise stored.
          </p>
        </div>
        <LiveRadarPanel />
      </main>
    );
  }

  const [sessionId, reviewedCount] = await Promise.all([
    getSessionId(),
    getReviewedCount()
  ]);

  const db = createServiceClient();
  const allowUnreviewed = !isCommunity && reviewedCount < 5;

  let q = db
    .from("reports")
    .select("*")
    .in("post_type", activeTypes)
    .is("community_id", null)
    .eq("held", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (!isCommunity && !allowUnreviewed) {
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
    .filter(
      (r) =>
        isCommunity ||
        r.reviewed ||
        allowUnreviewed ||
        r.session_id === sessionId
    )
    .map((r) => stripSession(r) as Report);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <Tabs tab={tab} />

      <div className="mb-6">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">
          {isCommunity ? "Community" : "Talk Am"}
        </h1>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
          {isCommunity
            ? "Talent, wins, gist, and everything else. Free form. Support the good ones. No tribal or party fights."
            : "Civic reports and accountability. Everything here requires evidence. Nothing gets deleted. Nothing carries ads. Ever."}
        </p>
      </div>

      {isCommunity ? <DailyPrompt /> : null}

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
        href={isCommunity ? "/submit?tab=community" : "/submit?tab=talk"}
        className="mt-10 flex min-h-[52px] items-center justify-center rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-accent-deep hover:shadow-card"
      >
        {isCommunity ? "Post to Community" : "Report Wetin Happen"}
      </Link>
    </main>
  );
}

function Tabs({ tab }: { tab: Tab }) {
  const items: Array<{ id: Tab; label: string; href: string }> = [
    { id: "civic", label: "Talk Am", href: "/talk" },
    { id: "community", label: "Community", href: "/talk?tab=community" },
    { id: "live", label: "Live", href: "/talk?tab=live" }
  ];

  return (
    <div className="mb-6 flex gap-2 border-b border-border">
      {items.map((it) => {
        const active = it.id === tab;
        return (
          <Link
            key={it.id}
            href={it.href}
            className={`border-b-2 px-4 py-3 font-serif text-[1.05rem] font-semibold transition-colors ${
              active
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}