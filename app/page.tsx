import Link from "next/link";
import { HomeFeed } from "@/components/ReportCard";
import { PAGE_SIZE } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";

export const dynamic = "force-dynamic";

const TALK_AM_TYPES = ["report_am", "ask", "help"];

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
  const sessionId = await getSessionId();
  const db = createServiceClient();

  const { count: reviewedCount } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reviewed", true)
    .in("post_type", TALK_AM_TYPES);

  let q = db
    .from("reports")
    .select("*")
    .in("post_type", TALK_AM_TYPES)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const allowUnreviewed = (reviewedCount ?? 0) < 5;
  if (!allowUnreviewed) {
    q = q.eq("reviewed", true);
  }
  if (searchParams.category) q = q.eq("category", searchParams.category);
  if (searchParams.agency) q = q.eq("agency_canonical", searchParams.agency);
  if (searchParams.status) q = q.eq("status", searchParams.status);
  if (searchParams.state) q = q.eq("state", searchParams.state);

  const { data } = await q;
  const reports = ((data ?? []) as Report[])
    .filter((r) => r.reviewed || allowUnreviewed || r.session_id === sessionId)
    .map((r) => stripSession(r) as Report);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Tab switcher */}
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
        filters={{
          state: searchParams.state,
          category: searchParams.category,
          agency: searchParams.agency
        }}
      />

      <Link
        href="/submit?tab=talk"
        className="mt-10 flex min-h-[52px] items-center justify-center rounded-2xl bg-warm px-5 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-warm-deep hover:shadow-card"
      >
        Report Wetin Happen
      </Link>
    </main>
  );
}