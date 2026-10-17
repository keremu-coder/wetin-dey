import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { getBlockedIds } from "@/lib/blocks";
import { CommentThread } from "@/components/CommentThread";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewedFlag } from "@/components/ReviewedFlag";
import { PostActions } from "@/components/PostActions";
import { ShareCard } from "@/components/ShareCard";
import { PublishedReplies } from "@/components/PublishedReplies";
import { ReplyTrigger } from "@/components/ReplyTrigger";
import { formatNaira } from "@/lib/constants";

export const dynamic = "force-dynamic";

function EvidenceBlock(report: {
  evidence_type: string | null;
  evidence_url: string | null;
  evidence_link: string | null;
  evidence_label: string | null;
  evidence_tier?: string | null;
}) {
  if (!report.evidence_type) return null;

  const label = report.evidence_label ?? "Evidence attached";
  const tier = report.evidence_tier ?? "unverified";
  const tierColor =
    tier === "strong"
      ? "text-brand border-brand/30 bg-brand-tint/60"
      : tier === "medium"
        ? "text-warm-deep border-warm/30 bg-warm-soft/40"
        : "text-faint border-border bg-ink/5";

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        className={`flex items-center justify-between border-b px-5 py-3 ${tierColor}`}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-current" />
          <p className="text-[0.75rem] font-semibold">
            {label}
          </p>
        </div>
        <span className="text-[0.75rem] font-medium opacity-80">
          {tier}
        </span>
      </div>

      <div className="p-5">
        {report.evidence_type === "photo" && report.evidence_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={report.evidence_url}
            alt="Evidence"
            className="w-full rounded-xl"
          />
        ) : null}

        {report.evidence_type === "video" && report.evidence_url ? (
          <video
            src={report.evidence_url}
            controls
            className="w-full rounded-xl"
          />
        ) : null}

        {report.evidence_type === "audio" && report.evidence_url ? (
          <div className="space-y-2">
            <p className="text-[0.8125rem] text-muted">
              Recorded evidence of the incident:
            </p>
            <audio src={report.evidence_url} controls className="h-10 w-full" />
          </div>
        ) : null}

        {report.evidence_type === "voice_testimony" && report.evidence_url ? (
          <div className="space-y-2">
            <p className="text-[0.8125rem] text-muted">
              First-person account from the reporter:
            </p>
            <audio src={report.evidence_url} controls className="h-10 w-full" />
            <p className="text-[0.7rem] leading-relaxed text-faint">
              This is the reporter&apos;s own account. It is not a recording of
              the incident itself.
            </p>
          </div>
        ) : null}

        {report.evidence_type === "public_link" && report.evidence_link ? (
          <a
            href={report.evidence_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all rounded-xl bg-ink/5 p-3 text-[0.875rem] text-brand underline"
          >
            {report.evidence_link}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function tierBadgeClass(tier: string): string {
  if (tier === "strong") {
    return "bg-brand-tint text-brand border-brand/30";
  }
  if (tier === "medium") {
    return "bg-warm-soft text-warm-deep border-warm/30";
  }
  return "bg-ink/5 text-faint border-border";
}

function tierBadgeLabel(tier: string): string {
  if (tier === "strong") return "Strong evidence";
  if (tier === "medium") return "Medium evidence";
  return "Unverified";
}

/**
 * Prominent banner shown on reports whose status is "disputed". By design
 * the report body stays visible — Wetin Dey is a host, not a publisher,
 * and the right of reply is the corrective, not removal. The banner makes
 * the disagreement impossible to miss and links to the published response
 * below. See docs/MODERATION-RUNBOOK.md for the legal reasoning.
 */
function DisputedBanner({ hasResponse }: { hasResponse: boolean }) {
  return (
    <div className="mb-5 rounded-2xl border-2 border-warm/50 bg-warm-soft/50 p-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-[1.5rem] leading-none" aria-hidden>
          ⚖️
        </span>
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold text-ink">
            Disputed — this report has been contested
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink/80">
            This report has been contested. The original content is shown
            below as it was submitted.{" "}
            {hasResponse ? (
              <>
                The official response is published further down —{" "}
                <a href="#replies" className="font-medium text-brand underline">
                  read the response
                </a>
                .
              </>
            ) : (
              "The response is pending approval."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function ReportPage(props: {

    params: Promise<{ id: string }>;

}) {
  const params = await props.params;

  const db = createServiceClient();
  const { data: report } = await db
    .from("reports")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!report) return notFound();

  const sessionId = await getSessionId();
  const blockedIds = await getBlockedIds(sessionId);

  let currentHandle: string | null = null;
  if (sessionId) {
    const { data: me } = await db
      .from("sessions")
      .select("handle")
      .eq("id", sessionId)
      .maybeSingle();
    currentHandle = me?.handle ?? null;
  }

  const title = report.agency_canonical || report.agency_raw || "Report";
  const authorHandle = (report as { author_handle?: string | null })
    .author_handle;
  const isOwnPost = !!authorHandle && currentHandle === authorHandle;
  const postUrl = `/r/${report.id}`;

  const reportSessionId = (report as { session_id?: string | null })
    .session_id;

  const held = (report as { held?: boolean | null }).held === true;
  const isPublic = report.reviewed === true && !held;
  const evidenceTier =
    (report as { evidence_tier?: string | null }).evidence_tier ?? null;
  const isDisputed = report.status === "disputed";

  if (!isOwnPost && reportSessionId && blockedIds.has(reportSessionId)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-faint transition-colors hover:text-brand"
        >
          ← Back to feed
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2.5rem]">🚫</div>
          <p className="mt-3 font-serif text-[1.15rem] font-semibold text-ink">
            You blocked this author
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
            You won&apos;t see their posts or comments. Manage your blocked
            list in{" "}
            <Link href="/settings/blocked" className="text-brand underline">
              Settings → Blocked users
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  if (held && !isOwnPost) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <Link
          href="/"
          className="text-[0.8125rem] font-medium text-faint hover:text-brand"
        >
          ← Back to feed
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2.5rem]">🔒</div>
          <p className="mt-3 font-serif text-[1.15rem] font-semibold text-ink">
            This report is under review
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
            Our moderators are checking it against our guidelines. If it meets
            the publication bar, it will appear here shortly.
          </p>
        </div>
      </main>
    );
  }

  const { data: repliesRaw } = await db
    .from("report_replies")
    .select("id, session_id, submitter_name, body, approved_at, created_at")
    .eq("report_id", report.id)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  const replies = (
    (repliesRaw ?? []) as Array<{
      id: string;
      session_id: string | null;
      submitter_name: string;
      body: string;
      approved_at: string | null;
      created_at: string;
    }>
  ).filter((r) => !r.session_id || !blockedIds.has(r.session_id));

  const upvotes = (report as { upvotes?: number }).upvotes ?? 0;
  const downvotes = (report as { downvotes?: number }).downvotes ?? 0;
  const meToo = (report as { me_too_count?: number }).me_too_count ?? 0;
  let myVote: "up" | "down" | "me_too" | null = null;
  if (sessionId) {
    const { data: voteRow } = await db
      .from("post_votes")
      .select("vote")
      .eq("post_id", report.id)
      .eq("session_id", sessionId)
      .maybeSingle();
    myVote = (voteRow?.vote as "up" | "down" | "me_too" | null) ?? null;
  }
  const commentCount =
    (report as { comment_count?: number }).comment_count ?? 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-faint transition-colors hover:text-brand"
      >
        ← Back to feed
      </Link>

      {held && isOwnPost ? (
        <div className="mt-4 rounded-2xl border-2 border-gold/50 bg-gold-soft/50 p-4">
          <p className="text-[0.875rem] font-semibold text-ink">
            ⚠ Your report is held for review
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink/80">
            Because it names a private individual or carries elevated legal
            risk, a moderator will review it before it appears in the public
            feed. You can still see it here.
          </p>
        </div>
      ) : null}

      <div className="mt-4 mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-[1.85rem] font-semibold leading-tight text-ink">
            {title}
          </h1>
          <ReviewedFlag reviewed={report.reviewed && !held} />
        </div>
        <p className="mt-1 text-[0.75rem] text-faint">
          {report.state}
          {report.lga ? ` · ${report.lga}` : ""} · {report.category}
        </p>
      </div>

      {isDisputed ? <DisputedBanner hasResponse={replies.length > 0} /> : null}

      <EvidenceBlock
        evidence_type={report.evidence_type}
        evidence_url={report.evidence_url}
        evidence_link={report.evidence_link}
        evidence_label={report.evidence_label}
        evidence_tier={evidenceTier}
      />

      {report.summary_pidgin ? (
        <div className="mb-5 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[0.8125rem] font-medium text-faint">
              Summary
            </p>
            <span
              className="rounded-full bg-ink/5 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-faint"
              title="This summary was generated by AI from the report text below. It is not independently verified."
            >
              AI-generated
            </span>
          </div>
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            {report.summary_pidgin}
          </p>
          {report.summary_english ? (
            <details className="mt-3 border-t border-border pt-3">
              <summary className="cursor-pointer text-[0.8125rem] font-medium text-brand">
                Read clean English version
              </summary>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
                {report.summary_english}
              </p>
            </details>
          ) : null}
        </div>
      ) : null}

      <article className="mb-5 rounded-2xl border border-border bg-surface p-5">
        <p className="mb-2 text-[0.8125rem] font-medium text-faint">
          Original report
        </p>
        <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink/90">
          {report.body}
        </p>
      </article>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={report.status} />
        {evidenceTier ? (
          <span
            className={`rounded-full border px-3 py-1 text-[0.75rem] font-medium ${tierBadgeClass(evidenceTier)}`}
          >
            {tierBadgeLabel(evidenceTier)}
          </span>
        ) : null}
        {report.amount_kobo != null ? (
          <span className="rounded-full bg-warm-soft px-3 py-1 text-[0.75rem] font-medium text-warm-deep">
            {formatNaira(report.amount_kobo)}
          </span>
        ) : null}
        <span className="text-[0.75rem] text-faint">
          {new Date(report.created_at).toLocaleDateString("en-NG", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "Africa/Lagos"
          })}
        </span>
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-surface p-3">
        <PostActions
          postId={report.id}
          isReport={report.post_type === "report_am"}
          authorHandle={authorHandle ?? null}
          isOwnPost={isOwnPost}
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialMeToo={meToo}
          initialMyVote={myVote}
          commentCount={commentCount}
          evidenceLink={report.evidence_link}
          postUrl={postUrl}
        />
      </div>

      <div className="mb-5">
        <ShareCard id={report.id} />
      </div>

      <div id="replies">
        <PublishedReplies replies={replies} />
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-surface/50 p-4">
        <p className="mb-3 text-[0.75rem] leading-relaxed text-faint">
          This report was submitted by a citizen with attached evidence. Wetin
          Dey has not independently verified it. If you are named and believe
          this is false, submit a reply below or{" "}
          <Link
            href={`/takedown?post=${report.id}`}
            className="underline hover:text-brand"
          >
            request a takedown
          </Link>
          .
        </p>
        <ReplyTrigger reportId={report.id} />
      </div>

      {isPublic || isOwnPost ? <CommentThread reportId={report.id} /> : null}
    </main>
  );
}