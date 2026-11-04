"use client";
import nextDynamic from "next/dynamic";

// Next 15 removed `ssr: false` support inside Server Components. This
// thin Client wrapper keeps Onboarding out of the server bundle and
// preserves the original behavior (client-only render).
export const Onboarding = nextDynamic(
  () => import("@/components/Onboarding").then((m) => m.Onboarding),
  { ssr: false }
);