export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { formalizeReport } from "@/lib/formalize";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  console.log("=== POST /api/formalize START ===");

  let reportId: string | null = null;
  try {
    const body = await req.json();
    reportId = body?.report_id ?? body?.id ?? null;
    console.log("[1] report_id:", reportId);
  } catch (e) {
    console.error("[1] JSON parse error:", e);
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (!reportId) {
    console.error("[1] FAIL: no report_id");
    return Response.json({ ok: false, error: "report_id required" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: report, error: fetchErr } = await db
    .from("reports")
    .select("id, category, agency_raw, state, body, amount_kobo, summary_pidgin")
    .eq("id", reportId)
    .single();

  if (fetchErr || !report) {
    console.error("[2] fetch FAILED:", fetchErr);
    return Response.json({ ok: false, error: "report not found" }, { status: 404 });
  }
  console.log("[2] fetched:", report.id);

  if (report.summary_pidgin) {
    console.log("[2] already formalized, skip");
    return Response.json({ ok: true, skipped: true });
  }

  let output;
  try {
    console.log("[3] calling formalizeReport...");
    output = await formalizeReport({
      category: report.category,
      agency_raw: report.agency_raw,
      state: report.state,
      body: report.body,
      amount_kobo: report.amount_kobo
    });
    console.log("[3] Gemini returned:", JSON.stringify(output));
  } catch (e) {
    console.error("[3] formalizeReport THREW:", e);
    return Response.json(
      { ok: false, error: "formalize failed: " + (e as Error).message },
      { status: 500 }
    );
  }

  const update = {
    summary_pidgin: output.summary_pidgin,
    summary_english: output.summary_english,
    agency_canonical: output.agency_canonical,
    incident_date: output.incident_date,
    amount_kobo: output.normalized_amount_kobo ?? report.amount_kobo,
    formalization_confidence: output.confidence,
    reviewed: output.confidence >= 0.7
  };
  console.log("[4] updating with:", JSON.stringify(update));

  const { error: updateErr } = await db
    .from("reports")
    .update(update)
    .eq("id", reportId);

  if (updateErr) {
    console.error("[4] UPDATE FAILED:", updateErr);
    return Response.json(
      { ok: false, error: "db update failed: " + updateErr.message },
      { status: 500 }
    );
  }

  console.log("[5] UPDATE OK");
  console.log("=== POST /api/formalize SUCCESS ===");
  return Response.json({ ok: true });
}