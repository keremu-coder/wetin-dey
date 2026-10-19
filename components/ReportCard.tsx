"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatNaira, nearestState } from "@/lib/constants";
import type { Report } from "@/lib/types";
import { canSeePhoto } from "@/lib/photo-visibility";
import { ZoomableAvatar } from "./ZoomableAvatar";
import { ReviewedFlag } from "./ReviewedFlag";
import { StatusBadge } from "./StatusBadge";
import { PostActions } from "./PostActions";

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric"
  });
}

export function ReportCard({
  report,
  currentHandle
}: {
  report: Report;
  currentHandle?: string | null;
}) {
  const title = report.agency_canonical || report.agency_raw;
  const blurb = report.summary_pidgin || report.body.slice(0, 180);
  const postType = report.post_type ?? "report_am";
  const isReport = postType === "report_am";

  const handleRaw =
    (report as unknown as { author_handle?: string | null }).author_handle || null;
  const hasHandle = !!handleRaw && handleRaw.length > 0;
  const isOwnPost = hasHandle && currentHandle === handleRaw;
  const authorLabel = hasHandle ? `@${handleRaw}` : "Anonymous member";

  // Attempt to extract avatar data if the DB query provides it
  const authorAvatarUrl = (report as unknown as { author_avatar_url?: string | null }).author_avatar_url;
  const authorPhotoVisibility = (report as unknown as { author_photo_visibility?: string | null }).author_photo_visibility;
  
  // targetId must be a non-empty string — fall back to report.id when anonymous
  const canSeeAuthorPhoto = canSeePhoto({
    viewerId: currentHandle ?? null,
    targetId: handleRaw || report.id,
    visibility: authorPhotoVisibility,
    isFollowing: false
  });

  const upvotes = (report as unknown as { upvotes?: number }).upvotes ?? 0;
  const downvotes = (report as unknown as { downvotes?: number }).downvotes ?? 0;
  const meToo = (report as unknown as { me_too_count?: number }).me_too_count ?? 0;
  const commentCount =
    (report as unknown as { comment_count?: number }).comment_count ?? 0;
  const evidenceLink =
    (report as unknown as { evidence_link?: string | null }).evidence_link ?? null;

  const postUrl = `/r/${report.id}`;

  return (
    <article className="group relative rounded-3xl border border-border bg-surface transition-colors hover:border-border-strong">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={hasHandle ? `/u/${encodeURIComponent(handleRaw)}` : postUrl}
              className="shrink-0 transition-opacity hover:opacity-80"
            >
              <ZoomableAvatar
                src={canSeeAuthorPhoto ? (authorAvatarUrl ?? null) : null}
                seed={handleRaw || report.id}
                size={40}
                title={authorLabel}
              />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-[0.875rem] font-medium text-ink">
                {authorLabel}
              </p>
              <p className="text-[0.75rem] text-faint">
                {timeAgo(report.created_at)} · {report.state}
                {report.lga ? ` · ${report.lga}` : ""}
              </p>
            </div>
          </div>
          <ReviewedFlag reviewed={report.reviewed} />
        </div>

        <Link href={postUrl} className="mt-4 block">
          <h3 className="font-serif text-[1.35rem] font-semibold leading-tight text-ink transition-colors group-hover:text-brand">
            {title}
          </h3>
        </Link>

        <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-relaxed text-ink/85">
          {blurb}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          {report.amount_kobo != null ? (
            <span className="rounded-full bg-warm-soft px-2.5 py-1 text-[0.75rem] font-medium text-warm-deep">
              {formatNaira(report.amount_kobo)}
            </span>
          ) : null}
          <Link
            href={`/?category=${encodeURIComponent(report.category)}`}
            className="rounded-full bg-ink/5 px-2.5 py-1 text-[0.7rem] capitalize text-muted transition-colors hover:bg-brand-tint hover:text-brand"
          >
            {report.category}
          </Link>
        </div>

        <PostActions
          postId={report.id}
          isReport={isReport}
          authorHandle={handleRaw}
          isOwnPost={isOwnPost}
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialMeToo={meToo}
          initialMyVote={(report as unknown as { my_vote?: "up" | "down" | "me_too" | null }).my_vote ?? null}
          commentCount={commentCount}
          evidenceLink={evidenceLink}
          postUrl={postUrl}
        />
      </div>
    </article>
  );
}

export function HomeFeed({
  reports,
  page,
  filters,
  currentHandle
}: {
  reports: Report[];
  page: number;
  filters: { state?: string; category?: string; agency?: string };
  currentHandle?: string | null;
}) {
  const [tab, setTab] = useState<"near" | "all">("near");
  const [nearState, setNearState] = useState<string | null>(filters.state ?? null);
  const [locating, setLocating] = useState(false);

  function askForLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const s = nearestState(pos.coords.latitude, pos.coords.longitude);
        setNearState(s);
        setLocating(false);
      },
      () => { setLocating(false); },
      { maximumAge: 3_600_000, timeout: 8000, enableHighAccuracy: false }
    );
  }

  const shown = useMemo(() => {
    if (tab === "all") return reports;
    if (!nearState) return reports;
    const local = reports.filter((r) => r.state === nearState);
    return local.length ? local : reports;
  }, [reports, tab, nearState]);

  const qs = new URLSearchParams();
  if (filters.category) qs.set("category", filters.category);
  if (filters.agency) qs.set("agency", filters.agency);
  if (tab === "near" && nearState) qs.set("state", nearState);
  const nextQs = new URLSearchParams(qs);
  nextQs.set("page", String(page + 1));

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-[0.875rem] font-medium transition-all ${
            tab === "near"
              ? "bg-brand text-white shadow-button"
              : "border border-border-strong bg-surface text-ink hover:bg-ink/5"
          }`}
          onClick={() => {
            if (!nearState) askForLocation();
            setTab("near");
          }}
        >
          {locating ? "Locating…" : `Near you${nearState ? ` (${nearState})` : ""}`}
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-[0.875rem] font-medium transition-all ${
            tab === "all"
              ? "bg-brand text-white shadow-button"
              : "border border-border-strong bg-surface text-ink hover:bg-ink/5"
          }`}
          onClick={() => setTab("all")}
        >
          All
        </button>
      </div>

      {filters.category ? (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[0.8125rem] text-muted">Showing category:</span>
          <span className="rounded-full bg-brand-tint px-3 py-1 text-[0.75rem] font-medium capitalize text-brand">
            {filters.category}
          </span>
          <a
            href="/"
            className="text-[0.75rem] text-faint underline hover:text-brand"
          >
            clear
          </a>
        </div>
      ) : (
        <p className="mb-6 text-[0.75rem] leading-relaxed text-faint">
          Near you dey use rough location for your phone. We no save coordinates.
        </p>
      )}

      <div className="space-y-4">
        {shown.map((r) => (
          <ReportCard key={r.id} report={r} currentHandle={currentHandle} />
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <p className="font-serif text-lg text-ink">No post dey here yet.</p>
          <p className="mt-1 text-sm text-muted">Be the first to talk am.</p>
        </div>
      ) : null}

      {reports.length >= 30 ? (
        <div className="mt-8 flex justify-center">
          <Link
            className="rounded-xl border border-border-strong bg-surface px-5 py-2.5 text-[0.875rem] font-medium text-ink transition-all hover:bg-ink/5"
            href={`/?${nextQs.toString()}`}
          >
            Load more
          </Link>
        </div>
      ) : null}
    </div>
  );
}

