import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const db = createServiceClient();
  const { data } = await db
    .from("reports")
    .select("agency_canonical, agency_raw, state, category")
    .eq("session_id", profile.id);

  // Aggregate by agency
  const map = new Map<string, { agency: string; count: number; state: string }>();
  for (const r of data ?? []) {
    const agency = r.agency_canonical || r.agency_raw || "Unknown";
    const key = `${agency}::${r.state}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { agency, count: 1, state: r.state });
    }
  }
  const agencies = Array.from(map.values()).sort((a, b) => b.count - a.count);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Agencies you've reported
        </h1>
      </div>

      {agencies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <p className="text-[0.9375rem] text-ink">
            You haven't reported any agency yet.
          </p>
          <Link
            href="/submit?tab=talk"
            className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white"
          >
            File your first report
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {agencies.map((a, i) => (
            <div
              key={`${a.agency}-${a.state}`}
              className={`flex items-center gap-3 px-4 py-4 ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="text-[1.15rem] text-warm-deep">🏛️</span>
              <div className="flex-1">
                <p className="text-[0.9375rem] font-medium text-ink">
                  {a.agency}
                </p>
                <p className="text-[0.75rem] text-muted">{a.state}</p>
              </div>
              <span className="font-mono text-[0.8125rem] text-muted">
                {a.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}