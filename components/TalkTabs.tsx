"use client";

import { useState } from "react";
import { HomeFeed } from "./ReportCard";
import { DailyPrompt } from "./DailyPrompt";
import type { Report } from "@/lib/types";

type Tab = "civic" | "community";

export function TalkTabs({
  civicReports,
  communityReports,
  civicPage,
  communityPage,
  currentHandle,
  filters,
  initialTab
}: {
  civicReports: Report[];
  communityReports: Report[];
  civicPage: number;
  communityPage: number;
  currentHandle: string | null;
  filters: {
    state?: string;
    category?: string;
    agency?: string;
  };
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  function switchTab(next: Tab) {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = next === "community" ? "/talk?tab=community" : "/talk";
      window.history.replaceState(null, "", url);
    }
  }

  const isCommunity = tab === "community";

  return (
    <>
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => switchTab("civic")}
          className={`border-b-2 px-4 py-3 font-serif text-[1.05rem] font-semibold transition-colors ${
            !isCommunity
              ? "border-brand text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Talk Am
        </button>
        <button
          type="button"
          onClick={() => switchTab("community")}
          className={`border-b-2 px-4 py-3 font-serif text-[1.05rem] font-semibold transition-colors ${
            isCommunity
              ? "border-brand text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Community
        </button>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">
          {isCommunity ? "Community" : "Talk Am"}
        </h1>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
          {isCommunity
            ? "Talent, wins, gist, and everything else. Free form. Support the good ones. No tribal or party fights."
            : "The community's memory. Everything wey Naija don see and settle \u2014 light, road, police, water. Shine your eye, add your own. E no dey disappear."}
        </p>
      </div>

      {isCommunity ? <DailyPrompt /> : null}

      {isCommunity ? (
        <HomeFeed
          reports={communityReports}
          page={communityPage}
          currentHandle={currentHandle}
          filters={filters}
        />
      ) : (
        <HomeFeed
          reports={civicReports}
          page={civicPage}
          currentHandle={currentHandle}
          filters={filters}
        />
      )}
    </>
  );
}