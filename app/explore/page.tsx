import { ExploreChartLoader } from "@/components/ExploreChartLoader";
import { CATEGORIES, NIGERIA_STATES, formatNaira } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams
}: {
  searchParams: {
    state?: string;
    category?: string;
    from?: string;
    to?: string;
  };
}) {
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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-4xl">See the pattern</h1>
      <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
        <select
          name="state"
          defaultValue={searchParams.state ?? ""}
          className="rounded-md border px-3 py-3"
        >
          <option value="">All states</option>
          {NIGERIA_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={searchParams.category ?? ""}
          className="rounded-md border px-3 py-3"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={searchParams.from ?? ""}
          className="rounded-md border px-3 py-3"
        />
        <input
          type="date"
          name="to"
          defaultValue={searchParams.to ?? ""}
          className="rounded-md border px-3 py-3"
        />
        <button
          className="rounded-md bg-accent py-3 text-white"
          type="submit"
        >
          Filter
        </button>
      </form>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/" className="rounded-lg bg-surface p-4">
          <p className="text-sm text-ink/60">Total reports</p>
          <p className="font-serif text-3xl">{total}</p>
        </Link>
        <Link href="/" className="rounded-lg bg-surface p-4">
          <p className="text-sm text-ink/60">Total ₦ demanded</p>
          <p className="font-serif text-3xl">
            {formatNaira(Math.round(naira * 100)) || "₦0"}
          </p>
        </Link>
        <Link href="/" className="rounded-lg bg-surface p-4">
          <p className="text-sm text-ink/60">This month</p>
          <p className="font-serif text-3xl">{thisMonth}</p>
        </Link>
        <Link href="/?status=resolved" className="rounded-lg bg-surface p-4">
          <p className="text-sm text-ink/60">% resolved</p>
          <p className="font-serif text-3xl">{pct}%</p>
        </Link>
      </div>

      <div className="mt-8">
        <ExploreChartLoader
          byVolume={byVolume}
          byNaira={byNaira}
          byWeek={weeks}
        />
      </div>
    </main>
  );
}