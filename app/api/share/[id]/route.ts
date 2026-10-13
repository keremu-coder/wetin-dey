export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildShareImage } from "@/lib/share-image";

/**
 * Serves the share card PNG for the in-app ShareCard dialog.
 *
 * Uses the same builder as app/r/[id]/opengraph-image.tsx so the image
 * shown in the app is byte-identical to the one WhatsApp/Twitter fetch
 * from the og:image meta tag.
 *
 * Public route — no auth. Anyone with the report URL can fetch the card.
 * That matches the og:image behaviour, which is also public.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
  const db = createServiceClient();

  const { data: report } = await db
    .from("reports")
    .select(
      "agency_canonical, agency_raw, state, lga, category, evidence_tier, summary_pidgin"
    )
    .eq("id", params.id)
    .maybeSingle();

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