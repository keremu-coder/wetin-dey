import { ExploreChartLoader } from "@/components/ExploreChartLoader";
import { CATEGORIES, NIGERIA_STATES, formatNaira } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ExplorePage(props: {

    searchParams: Promise<{
    state?: string;
    category?: string;
    from?: string;
    to?: string;
  }>;

}) {
  const searchParams = await props.searchParams;

  const db = createServiceClient();
  let q = db.from("reports").select("*").eq("reviewed", true);
  if (searchParams.state) q = q.eq("state", searchParams.state);
  if (searchParams.category) q = q.eq("category", searchParams.category);
  if (searchParams.from) q = q.gte("created_at", searchParams.from);
  if (searchParams.to) q = q.lte("created_at", searchParams.to);
  const { data } = await q;
  const reports = (data ?? []) as Report[];

  const total = reports.length;
  const naira =
    reports.reduce((s, r) => s + (r.amount_kobo ?? 0), 0) / 100;
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const thisMonth = reports.filter(
    (r) => new Date(r.created_at) >= startMonth
  ).length;
  const resolved = reports.filter((r) => r.status === "resolved").length;
  const awaitingResponse = reports.filter(
    (r) => r.status === "reported" || r.status === "forwarded"
  ).length;
  const pct = total ? Math.round((resolved / total) * 100) : 0;

  const volMap = new Map<string, number>();
  const nairaMap = new Map<string, number>();
  for (const r of reports) {
    const a = r.agency_canonical || r.agency_raw;
    volMap.set(a, (volMap.get(a) ?? 0) + 1);
    nairaMap.set(a, (nairaMap.get(a) ?? 0) + (r.amount_kobo ?? 0) / 100);
  }
  const byVolume = [...volMap.entries()]
    .map(([agency, count]) => ({ agency, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const byNaira = [...nairaMap.entries()]
    .map(([agency, n]) => ({ agency, naira: Math.round(n) }))
    .sort((a, b) => b.naira - a.naira)
    .slice(0, 10);

  const weeks: { week: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    weeks.push({ week: key, count: 0 });
  }
  for (const r of reports) {
    const t = new Date(r.created_at).getTime();
    for (let i = 0; i < weeks.length; i++) {
      const start = new Date(weeks[i].week).getTime();
      const end = start + 7 * 24 * 3600 * 1000;
      if (t >= start && t < end) {
        weeks[i].count += 1;
        break;
      }
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[0.7rem] text-faint transition-colors hover:text-brand"
      >
        ← Back to feed
      </Link>

      <div className="mt-4 mb-5">
        <h1 className="font-serif text-[1.85rem] font-semibold leading-tight text-ink">
          See the pattern
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Every reviewed report, filterable. The whole civic archive — no
          editorial selection.
        </p>
      </div>

      <form className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="filter-state"
              className="mb-1.5 block text-[0.65rem] text-faint"
            >
              State
            </label>
            <select
              id="filter-state"
              name="state"
              defaultValue={searchParams.state ?? ""}
            >
              <option value="">All states</option>
              {NIGERIA_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-category"
              className="mb-1.5 block text-[0.65rem] text-faint"
            >
              Category
            </label>
            <select
              id="filter-category"
              name="category"
              defaultValue={searchParams.category ?? ""}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-from"
              className="mb-1.5 block text-[0.65rem] text-faint"
            >
              From
            </label>
            <input
              id="filter-from"
              type="date"
              name="from"
              defaultValue={searchParams.from ?? ""}
            />
          </div>
          <div>
            <label
              htmlFor="filter-to"
              className="mb-1.5 block text-[0.65rem] text-faint"
            >
              To
            </label>
            <input
              id="filter-to"
              type="date"
              name="to"
              defaultValue={searchParams.to ?? ""}
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-brand py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-brand-soft"
        >
          Filter
        </button>
      </form>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[0.65rem] text-faint">
            Total reports
          </p>
          <p className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-ink">
            {total}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[0.65rem] text-faint">
            Total demanded
          </p>
          <p className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-ink">
            {formatNaira(Math.round(naira * 100))}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[0.65rem] text-faint">
            This month
          </p>
          <p className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-ink">
            {thisMonth}
          </p>
        </div>
        {resolved > 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-[0.65rem] text-faint">
              Resolved
            </p>
            <p className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-brand">
              {pct}%
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-[0.65rem] text-faint">
              Awaiting
            </p>
            <p className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-warm-deep">
              {awaitingResponse}
            </p>
          </div>
        )}
      </div>

      <ExploreChartLoader
        byVolume={byVolume}
        byNaira={byNaira}
        byWeek={weeks}
      />
    </main>
  );
}
