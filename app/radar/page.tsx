import Link from "next/link";
import { LiveRadarPanel } from "@/components/LiveRadarPanel";
import { FamilyCheckinPanel } from "@/components/FamilyCheckinPanel";

export const dynamic = "force-dynamic";

type Tab = "public" | "family";

export default function RadarPage({
  searchParams
}: {
  searchParams: { tab?: string };
}) {
  const rawTab = (searchParams.tab ?? "public").toLowerCase();
  const tab: Tab = rawTab === "family" ? "family" : "public";

  const tabs: Array<{ id: Tab; label: string; href: string; icon: string }> = [
    { id: "public", label: "Public", href: "/radar", icon: "📡" },
    { id: "family", label: "Family", href: "/radar?tab=family", icon: "🏠" }
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-4">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">
          Radar
        </h1>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
          {tab === "public"
            ? "Real-time signals from your area. NEPA, checkpoints, floods. One tap to signal. Rounded to ~1 km."
            : "Are your people safe? Start a check-in in a space and everyone answers with one tap."}
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 font-serif text-[1.05rem] font-semibold transition-colors ${
                active
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <span className="text-[1.15rem]">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "public" ? <LiveRadarPanel /> : <FamilyCheckinPanel />}
    </main>
  );
}