import { HomeFeed } from "@/components/ReportCard";
import { PAGE_SIZE } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams: { page?: string; state?: string; category?: string; agency?: string; status?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const sessionId = await getSessionId();
  const db = createServiceClient();

  const { count: reviewedCount } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reviewed", true);

  let q = db
    .from("reports")
    .select("*")
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
      <h1 className="font-serif text-4xl leading-tight">Wetin Dey</h1>
      <p className="mt-2 text-ink/70">Talk am. See wetin others dey talk. No name, no wahala.</p>
      <div className="mt-6">
        <HomeFeed
          reports={reports}
          page={page}
          filters={{
            state: searchParams.state,
            category: searchParams.category,
            agency: searchParams.agency
          }}
        />
      </div>
      <Link
        href="/submit"
        className="mt-10 flex min-h-[52px] items-center justify-center rounded-lg bg-accent text-lg font-medium text-white"
      >
        Talk Am
      </Link>
    </main>
  );
}