"use client";

import dynamic from "next/dynamic";

// Recharts is ~100kB. It only runs on /explore, but it was blocking first
// paint. This wrapper lazy-loads it after the page shell renders — the
// user sees the stats immediately, the charts slide in a beat later.

const ExploreChart = dynamic(
  () =>
    import("./ExploreChart").then((m) => ({
      default: m.ExploreChart
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <p className="text-[0.7rem] text-faint">
          Loading charts…
        </p>
      </div>
    )
  }
);

type Props = {
  byVolume: { agency: string; count: number }[];
  byNaira: { agency: string; naira: number }[];
  byWeek: { week: string; count: number }[];
};

export function ExploreChartLoader(props: Props) {
  return <ExploreChart {...props} />;
}