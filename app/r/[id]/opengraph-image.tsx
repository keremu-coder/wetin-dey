import { createServiceClient } from "@/lib/supabase/server";
import {
  buildShareImage,
  SHARE_IMAGE_SIZE,
  SHARE_IMAGE_CONTENT_TYPE
} from "@/lib/share-image";

// Next.js auto-detects this file for the /r/[id] route and emits
// <meta property="og:image"> with the generated PNG. WhatsApp, Twitter,
// Telegram, and Slack all pick it up when a report URL is pasted.

export const runtime = "nodejs";
export const alt = "Wetin Dey report";
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_CONTENT_TYPE;

export default async function Image({
  params
}: {
  params: { id: string };
}) {
  const db = createServiceClient();

  const { data: report } = await db
    .from("reports")
    .select(
      "agency_canonical, agency_raw, state, lga, category, evidence_tier, summary_pidgin"
    )
    .eq("id", params.id)
    .maybeSingle();

  // Not found or unreviewed: return a plain fallback card so the link
  // does not 404 when shared.
  const title = report
    ? report.agency_canonical || report.agency_raw || "Report"
    : "Wetin Dey";

  return buildShareImage({
    title,
    state: report?.state ?? null,
    lga: report?.lga ?? null,
    category: report?.category ?? null,
    evidenceTier: report?.evidence_tier ?? null,
    summaryPidgin: report?.summary_pidgin ?? null
  });
}