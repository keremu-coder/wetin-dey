"use client";
import nextDynamic from "next/dynamic";

// Next 15 removed `ssr: false` support inside Server Components. This
// thin Client wrapper keeps ReportForm out of the server bundle.
export const ReportForm = nextDynamic(
  () => import("@/components/ReportForm").then((m) => m.ReportForm),
  { ssr: false }
);