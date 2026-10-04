import { notFound } from "next/navigation";
import { CommentThread } from "@/components/CommentThread";
import { MeTooButton } from "@/components/MeTooButton";
import { ReviewedFlag } from "@/components/ReviewedFlag";
import { ShareCard } from "@/components/ShareCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatNaira } from "@/lib/constants";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Comment, type Report } from "@/lib/types";
import { ReportActions } from "./report-actions";

export const dynamic = "force-dynamic";

const TIMELINE = ["reported", "forwarded", "acknowledged", "resolved"] as const;

export default async function ReportPage({ params }: { params: { id: string } }) {
  const sessionId = await getSessionId();
  const db = createServiceClient();
  const { data } = await db.from("reports").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const raw = data as Report;
  if (!raw.reviewed && raw.session_id !== sessionId) notFound();
  const report = stripSession(raw) as Report;

  const { data: comments } = await db
    .from("comments")
    .select("id, report_id, created_at, body, reviewed, hidden")
    .eq("report_id", params.id)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(50);

  const { count } = await db
    .from("me_toos")
    .select("id", { count: "exact", head: true })
    .eq("report_id", params.id);

  let mine = false;
  if (sessionId) {
    const { data: existing } = await db
      .from("me_toos")
      .select("id")
      .eq("report_id", params.id)
      .eq("session_id", sessionId)
      .maybeSingle();
    mine = Boolean(existing);
  }

  const idx = TIMELINE.indexOf(report.status as (typeof TIMELINE)[number]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{report.agency_canonical || report.agency_raw}</h1>
          <p className="mt-1 text-sm text-ink/70">
            {report.state}
            {report.lga ? ` · ${report.lga}` : ""} · {report.category} · {report.id}
          </p>
        </div>
        <ReviewedFlag reviewed={report.reviewed} />
      </header>

      <div className="mt-5 rounded-lg border-2 border-accent/40 bg-white p-4">
        <p className="font-serif text-2xl leading-snug">
          {report.summary_pidgin || "Summary still dey cook. Original story dey below."}
        </p>
        <p className="mt-3 text-sm text-ink/70">
          {report.summary_english || "English summary will appear after formalization."}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={report.status} />
        {report.amount_kobo != null ? <span>{formatNaira(report.amount_kobo)}</span> : null}
      </div>

      <ol className="mt-6 flex gap-2 overflow-x-auto text-xs">
        {TIMELINE.map((step, i) => (
          <li
            key={step}
            className={`min-w-[6.5rem] rounded-md px-2 py-3 text-center ${
              report.status === "disputed"
                ? "bg-yellow-100"
                : i <= Math.max(idx, 0)
                  ? "bg-accent/15"
                  : "bg-ink/5"
            }`}
          >
            {step}
          </li>
        ))}
      </ol>
      {report.status === "disputed" ? (
        <p className="mt-2 text-sm">⚠️ This report na disputed. URL still dey live.</p>
      ) : null}

      <article className="mt-6 whitespace-pre-wrap text-base leading-relaxed">{report.body}</article>

      {report.evidence_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={report.evidence_url} alt="Evidence" className="mt-6 w-full rounded-md border border-ink/10" />
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <MeTooButton reportId={report.id} initialCount={count ?? 0} initialMine={mine} />
        <ShareCard id={report.id} />
      </div>

      <CommentThread reportId={report.id} initial={(comments ?? []) as Comment[]} />

      <ReportActions reportId={report.id} />
    </main>
  );
}
