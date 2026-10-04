import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { CommentThread } from "@/components/CommentThread";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewedFlag } from "@/components/ReviewedFlag";
import { formatNaira } from "@/lib/constants";

export const dynamic = "force-dynamic";

function EvidenceBlock(report: {
  evidence_type: string | null;
  evidence_url: string | null;
  evidence_link: string | null;
  evidence_label: string | null;
}) {
  if (!report.evidence_type) return null;

  const label = report.evidence_label ?? "Evidence attached";

  return (
    <div className="mb-6 rounded-2xl border-2 border-accent/30 bg-accent-soft/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-accent-deep">
          {label}
        </p>
      </div>

      {report.evidence_type === "photo" && report.evidence_url ? (
        <img
          src={report.evidence_url}
          alt="Evidence"
          className="w-full rounded-xl border border-accent/20"
        />
      ) : null}

      {report.evidence_type === "video" && report.evidence_url ? (
        <video
          src={report.evidence_url}
          controls
          className="w-full rounded-xl border border-accent/20"
        />
      ) : null}

      {report.evidence_type === "audio" && report.evidence_url ? (
        <div className="space-y-2">
          <p className="text-[0.8125rem] text-muted">
            Recorded evidence of the incident:
          </p>
          <audio
            src={report.evidence_url}
            controls
            className="h-10 w-full"
          />
        </div>
      ) : null}

      {report.evidence_type === "voice_testimony" && report.evidence_url ? (
        <div className="space-y-2">
          <p className="text-[0.8125rem] text-muted">
            First-person account from the reporter:
          </p>
          <audio
            src={report.evidence_url}
            controls
            className="h-10 w-full"
          />
          <p className="text-[0.75rem] leading-relaxed text-faint">
            This is the reporter's own account of what happened. It is not a
            recording of the incident itself.
          </p>
        </div>
      ) : null}

      {report.evidence_type === "public_link" && report.evidence_link ? (
        <a
          href={report.evidence_link}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all rounded-xl bg-surface p-3 text-[0.875rem] text-accent underline"
        >
          {report.evidence_link}
        </a>
      ) : null}
    </div>
  );
}

export default async function ReportPage({
  params
}: {
  params: { id: string };
}) {
  const db = createServiceClient();
  const { data: report } = await db
    .from("reports")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!report) return notFound();

  const title = report.agency_canonical || report.agency_raw || "Report";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← Back to feed
        </Link>
        <div className="mt-4 flex items-start justify-between gap-3">
          <h1 className="font-serif text-[1.85rem] font-semibold leading-tight text-ink">
            {title}
          </h1>
          <ReviewedFlag reviewed={report.reviewed} />
        </div>
        <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-wide text-faint">
          {report.state}
          {report.lga ? ` · ${report.lga}` : ""} · {report.category}
        </p>
      </div>

      {/* Evidence */}
      <EvidenceBlock
        evidence_type={report.evidence_type}
        evidence_url={report.evidence_url}
        evidence_link={report.evidence_link}
        evidence_label={report.evidence_label}
      />

      {/* AI summary */}
      {report.summary_pidgin ? (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            {report.summary_pidgin}
          </p>
          {report.summary_english ? (
            <p className="mt-3 border-t border-border pt-3 text-[0.875rem] italic text-muted">
              {report.summary_english}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.875rem] text-muted">Summary still dey cook…</p>
        </div>
      )}

      {/* Original body */}
      <article className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink/90">
          {report.body}
        </p>
      </article>

      {/* Meta row */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <StatusBadge status={report.status} />
        {report.amount_kobo != null ? (
          <span className="rounded-full bg-warm-soft px-3 py-1 text-[0.75rem] font-medium text-warm-deep">
            {formatNaira(report.amount_kobo)}
          </span>
        ) : null}
        <span className="font-mono text-[0.7rem] text-faint">
          {new Date(report.created_at).toLocaleDateString("en-NG", {
            month: "long",
            day: "numeric",
            year: "numeric"
          })}
        </span>
      </div>

      {/* Trust disclaimer */}
      <div className="mb-8 rounded-2xl border border-border bg-paper p-4">
        <p className="text-[0.75rem] leading-relaxed text-faint">
          This report was submitted by a citizen with attached evidence. Wetin
          Dey has not independently verified it. If you are named and believe
          this is false, submit a{" "}
          <Link href="/takedown" className="underline hover:text-accent">
            dispute
          </Link>
          .
        </p>
      </div>

      {/* Comments */}
      <CommentThread reportId={report.id} />
    </main>
  );
}