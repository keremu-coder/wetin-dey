import { jsonError } from "@/lib/http";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const sessionId = await getSessionId();
  const db = createServiceClient();
  // Audit finding 10: select("*") leaked internal columns to any
  // caller who fetched a public report:
  //   - defamation_risk, defamation_reasons: internal risk score
  //   - reviewer_note: what the moderator wrote
  //   - dedupe_hash: internal deduplication fingerprint
  //   - telegram_message_id: internal mirror id
  //   - formalization_confidence: internal AI score
  // The columns below are the ones the client actually renders plus
  // the ones the author-visibility check below needs (reviewed, held,
  // session_id). session_id is stripped before response by stripSession.
  const { data, error } = await db
    .from("reports")
    .select(
      "id, created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo, evidence_url, evidence_type, evidence_link, evidence_label, summary_pidgin, summary_english, incident_date, status, reviewed, held, author_handle, post_type, upvotes, downvotes, me_too_count, comment_count, evidence_tier, target_type, community_id, session_id"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError("no load", 500);
  if (!data) return jsonError("no dey", 404);

  const report = data as Report;

  // C1 Fix: A report that is unreviewed OR held must only be visible
  // to its author. Everyone else gets a 404.
  if ((!report.reviewed || report.held) && report.session_id !== sessionId) {
    return jsonError("no dey", 404);
  }

  return Response.json({ report: stripSession(report) });
}
