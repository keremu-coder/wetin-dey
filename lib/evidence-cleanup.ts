import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * C3 fix: delete the underlying evidence storage object when a report
 * is hidden (held: true).
 *
 * The reports table stores evidence_url as a public URL to the
 * `evidence` bucket. Setting held=true removes the row from public
 * queries, but the file itself stayed reachable at its URL — so a
 * report "removed within 24 hours" per our own rules still leaked
 * its photo, video, audio, or voice testimony to anyone with the URL.
 *
 * This helper:
 *   1. Reads the row's evidence_url and evidence_type.
 *   2. If evidence_type is public_link, returns (no storage object).
 *   3. If evidence_url is not in the `evidence` bucket, returns
 *      (defensive: no cross-bucket cleanup, ever).
 *   4. Deletes the storage object.
 *
 * We deliberately DO NOT null the evidence_url column. The URL will
 * 404 when re-fetched, which is the correct behavior if a moderator
 * later unhides the report: the report has broken evidence rather
 * than evidence silently reappearing. The row retains its metadata
 * (evidence_type, evidence_label) for the audit trail.
 *
 * Voice notes in chat/comments/broadcasts live in a different bucket
 * (`voice-notes`) and are not touched here — deferred to a follow-up.
 */
export async function deleteReportEvidence(reportId: string): Promise<void> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("reports")
    .select("evidence_url, evidence_type")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) return;

  const url = data.evidence_url as string | null;
  const type = data.evidence_type as string | null;

  if (!url) return;
  if (type === "public_link") return;

  const marker = "/storage/v1/object/public/evidence/";
  const idx = url.indexOf(marker);
  if (idx < 0) return;

  const path = url.slice(idx + marker.length);
  if (!path) return;

  try {
    await db.storage.from("evidence").remove([path]);
  } catch (e) {
    console.error("[evidence-cleanup] storage remove failed:", e);
  }
}
