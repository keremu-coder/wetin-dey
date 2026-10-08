import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/constants";
import { ModerateActions } from "./moderate-actions";
import { FlagQueue, type FlagRow } from "@/components/FlagQueue";

export const dynamic = "force-dynamic";

type HeldReport = {
  id: string;
  created_at: string;
  agency_raw: string | null;
  agency_canonical: string | null;
  state: string | null;
  body: string;
  category: string;
  amount_kobo: number | null;
  defamation_risk: number | null;
  defamation_reasons: unknown;
  target_type: string | null;
  author_handle: string | null;
  evidence_type: string | null;
};

type PendingReply = {
  id: string;
  report_id: string;
  submitter_name: string;
  submitter_contact: string;
  body: string;
  created_at: string;
};

type RawFlag = {
  id: string;
  session_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
};

async function resolveFlagForAdmin(
  db: ReturnType<typeof createServiceClient>,
  flag: RawFlag
): Promise<FlagRow> {
  const reporterHandle: string | null = null;
  let targetPreview: string | null = null;
  let targetAuthorId: string | null = null;
  let targetHref: string | null = null;

  const { data: reporter } = await db
    .from("sessions")
    .select("handle")
    .eq("id", flag.session_id)
    .maybeSingle();

  const reporterHandleFinal = reporter?.handle ?? null;

  if (flag.target_type === "message") {
    const { data } = await db
      .from("community_messages")
      .select("body, audio_url, session_id")
      .eq("id", flag.target_id)
      .maybeSingle();
    targetPreview = data?.body ?? (data?.audio_url ? "(voice note)" : null);
    targetAuthorId = data?.session_id ?? null;
  } else if (flag.target_type === "comment") {
    const { data } = await db
      .from("comments")
      .select("body, audio_url, session_id, report_id")
      .eq("id", flag.target_id)
      .maybeSingle();
    targetPreview = data?.body ?? (data?.audio_url ? "(voice note)" : null);
    targetAuthorId = data?.session_id ?? null;
    if (data?.report_id) targetHref = `/r/${data.report_id}`;
  } else if (flag.target_type === "post" || flag.target_type === "report") {
    const { data } = await db
      .from("reports")
      .select("body, summary_pidgin, session_id")
      .eq("id", flag.target_id)
      .maybeSingle();
    targetPreview = data?.summary_pidgin ?? data?.body ?? null;
    targetAuthorId = data?.session_id ?? null;
    targetHref = `/r/${flag.target_id}`;
  } else if (flag.target_type === "dm_message") {
    const { data } = await db
      .from("dm_messages")
      .select("body, sender_id")
      .eq("id", flag.target_id)
      .maybeSingle();
    targetPreview = data?.body ?? null;
    targetAuthorId = data?.sender_id ?? null;
  } else if (flag.target_type === "broadcast") {
    const { data } = await db
      .from("broadcasts")
      .select("title, session_id")
      .eq("id", flag.target_id)
      .maybeSingle();
    targetPreview = data?.title ?? "(voice broadcast)";
    targetAuthorId = data?.session_id ?? null;
  } else if (flag.target_type === "user") {
    const { data } = await db
      .from("sessions")
      .select("handle, bio")
      .eq("id", flag.target_id)
      .maybeSingle();
    targetPreview = data?.bio ?? null;
    targetAuthorId = flag.target_id;
    if (data?.handle) targetHref = `/u/${encodeURIComponent(data.handle)}`;
  } else if (flag.target_type === "community") {
    const { data } = await db
      .from("communities")
      .select("name, description, owner_session_id, slug")
      .eq("id", flag.target_id)
      .maybeSingle();
    targetPreview = data?.description ?? data?.name ?? null;
    targetAuthorId = data?.owner_session_id ?? null;
    if (data?.slug) targetHref = `/c/${data.slug}`;
  } else if (flag.target_type === "dm_thread") {
    targetPreview = "(DM conversation)";
  }

  let targetAuthorHandle: string | null = null;
  if (targetAuthorId) {
    const { data: author } = await db
      .from("sessions")
      .select("handle")
      .eq("id", targetAuthorId)
      .maybeSingle();
    targetAuthorHandle = author?.handle ?? null;
  }

  return {
    id: flag.id,
    session_id: flag.session_id,
    target_type: flag.target_type,
    target_id: flag.target_id,
    reason: flag.reason,
    note: flag.note,
    status: flag.status,
    created_at: flag.created_at,
    reporter_handle: reporterHandleFinal ?? reporterHandle,
    target_preview: targetPreview,
    target_author_handle: targetAuthorHandle,
    target_href: targetHref
  };
}

export default async function AdminPendingPage() {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/signin");

  const db = createServiceClient();

  const { data: admin } = await db
    .from("admins")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!admin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <div className="rounded-2xl border border-danger/30 bg-danger-soft p-6">
          <p className="font-serif text-[1.15rem] font-semibold text-danger">
            Admin only
          </p>
          <p className="mt-2 text-[0.875rem] text-ink">
            This page is for moderators. If you should have access, contact the
            owner.
          </p>
        </div>
      </main>
    );
  }

  const [heldRes, repliesRes, flagsRes] = await Promise.all([
    db
      .from("reports")
      .select(
        "id, created_at, agency_raw, agency_canonical, state, body, category, amount_kobo, defamation_risk, defamation_reasons, target_type, author_handle, evidence_type"
      )
      .eq("held", true)
      .eq("reviewed", false)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("report_replies")
      .select(
        "id, report_id, submitter_name, submitter_contact, body, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("content_flags")
      .select(
        "id, session_id, target_type, target_id, reason, note, status, created_at"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  const held = (heldRes.data ?? []) as HeldReport[];
  const replies = (repliesRes.data ?? []) as PendingReply[];
  const rawFlags = (flagsRes.data ?? []) as RawFlag[];

  const flags: FlagRow[] = [];
  for (const f of rawFlags) {
    flags.push(await resolveFlagForAdmin(db, f));
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6">
        <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-ink">
          Moderation
        </h1>
        <p className="mt-1 text-[0.875rem] text-muted">
          Held reports, pending right-of-reply submissions, and open content
          flags.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-serif text-[1.15rem] font-semibold text-ink">
          Content flags <span className="text-muted">({flags.length})</span>
        </h2>
        <FlagQueue flags={flags} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-serif text-[1.15rem] font-semibold text-ink">
          Held reports{" "}
          <span className="text-muted">({held.length})</span>
        </h2>

        {held.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-[0.875rem] text-muted">
              No reports held for review right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {held.map((r) => {
              const reasons = Array.isArray(r.defamation_reasons)
                ? (r.defamation_reasons as string[])
                : [];
              const risk =
                typeof r.defamation_risk === "number"
                  ? Math.round(r.defamation_risk * 100)
                  : 0;

              return (
                <article
                  key={r.id}
                  className="rounded-2xl border border-gold/40 bg-gold-soft/30 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-semibold text-ink">
                        {r.agency_canonical || r.agency_raw || "Report"}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-wide text-faint">
                        {r.state ?? "?"} · {r.category} ·{" "}
                        {new Date(r.created_at).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric"
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-bold ${
                        risk >= 80
                          ? "bg-danger text-white"
                          : risk >= 60
                            ? "bg-gold text-ink"
                            : "bg-ink/10 text-ink"
                      }`}
                    >
                      RISK {risk}%
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-4 text-[0.875rem] leading-relaxed text-ink/85">
                    {r.body}
                  </p>

                  {reasons.length > 0 ? (
                    <ul className="mt-3 space-y-0.5">
                      {reasons.slice(0, 4).map((reason, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-[0.75rem] text-muted"
                        >
                          <span className="mt-0.5 text-faint">·</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[0.65rem] text-muted">
                      {r.target_type ?? "public"}
                    </span>
                    {r.evidence_type ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.65rem] text-accent-deep">
                        {r.evidence_type}
                      </span>
                    ) : (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 font-mono text-[0.65rem] text-danger">
                        no evidence
                      </span>
                    )}
                    {r.amount_kobo != null ? (
                      <span className="rounded-full bg-warm-soft px-2 py-0.5 font-mono text-[0.65rem] text-warm-deep">
                        {formatNaira(r.amount_kobo)}
                      </span>
                    ) : null}
                  </div>

                  <Link
                    href={`/r/${r.id}`}
                    className="mt-3 inline-block text-[0.75rem] font-medium text-accent hover:underline"
                  >
                    View full report →
                  </Link>

                  <div className="mt-3 border-t border-gold/30 pt-3">
                    <ModerateActions kind="report" targetId={r.id} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-[1.15rem] font-semibold text-ink">
          Right-of-reply submissions{" "}
          <span className="text-muted">({replies.length})</span>
        </h2>

        {replies.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-[0.875rem] text-muted">
              No pending replies right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((r) => (
              <article
                key={r.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[0.9375rem] font-semibold text-ink">
                    {r.submitter_name}
                  </p>
                  <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                    {new Date(r.created_at).toLocaleDateString("en-NG", {
                      month: "short",
                      day: "numeric"
                    })}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[0.7rem] text-faint">
                  {r.submitter_contact}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-ink/90">
                  {r.body}
                </p>

                <Link
                  href={`/r/${r.report_id}`}
                  className="mt-3 inline-block text-[0.75rem] font-medium text-accent hover:underline"
                >
                  View report →
                </Link>

                <div className="mt-3 border-t border-border pt-3">
                  <ModerateActions kind="reply" targetId={r.id} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}