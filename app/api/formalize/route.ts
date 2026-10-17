export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { formalizeReport } from "@/lib/formalize";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreDefamation } from "@/lib/defamation";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getSessionId } from "@/lib/session";

export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  const sessionId = await getSessionId();
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const limit = await checkRateLimit(
    sessionId,
    {
      key: "formalize",
      limit: 5,
      windowMs: 60 * 60 * 1000
    },
    { ip: getRequestIp(req) }
  );

  if (!limit.ok) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let reportId: string | null = null;
  try {
    const body = await req.json();
    reportId = body?.report_id ?? body?.id ?? null;
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (!reportId) {
    return Response.json(
      { ok: false, error: "report_id required" },
      { status: 400 }
    );
  }

  const db = createServiceClient();

  const { data: report, error: fetchErr } = await db
    .from("reports")
    .select(
      "id, category, agency_raw, state, body, amount_kobo, summary_pidgin, target_type, held, defamation_risk, defamation_reasons, evidence_type, evidence_link, session_id"
    )
    .eq("id", reportId)
    .single();

  if (fetchErr || !report) {
    return Response.json(
      { ok: false, error: "report not found" },
      { status: 404 }
    );
  }

  if (report.session_id !== sessionId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (report.summary_pidgin) {
    return Response.json({ ok: true, skipped: true });
  }

  let output;
  try {
    output = await formalizeReport({
      category: report.category,
      agency_raw: report.agency_raw,
      state: report.state,
      body: report.body,
      amount_kobo: report.amount_kobo
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: "formalize failed" },
      { status: 500 }
    );
  }

  // Combine heuristic (already stored at insert) + AI risk.
  const heuristic = scoreDefamation({
    body: report.body,
    agency_raw: report.agency_raw,
    agency_canonical: report.agency_raw,
    amount_kobo: report.amount_kobo,
    evidence_url: null,
    public_link: report.evidence_link ?? null
  });

  const storedRisk =
    typeof report.defamation_risk === "number"
      ? report.defamation_risk
      : heuristic.risk;
  const aiRisk = output.defamation_risk ?? 0;
  const combinedRisk = Math.max(storedRisk, aiRisk, heuristic.risk);

  const existingReasons: string[] = Array.isArray(report.defamation_reasons)
    ? (report.defamation_reasons as string[])
    : [];
  const combinedReasons = Array.from(
    new Set([
      ...existingReasons,
      ...heuristic.reasons,
      ...(Array.isArray(output.defamation_reasons)
        ? output.defamation_reasons
        : [])
    ])
  );

  // Still held if it was held before OR if the combined risk is high.
  const stillHeld = report.held === true || combinedRisk >= 0.6;

  const update = {
    summary_pidgin: output.summary_pidgin,
    summary_english: output.summary_english,
    agency_canonical: output.agency_canonical,
    incident_date: output.incident_date,
    amount_kobo: output.normalized_amount_kobo ?? report.amount_kobo,
    formalization_confidence: output.confidence,
    // Never mark reviewed=true if still held.
    reviewed: !stillHeld && output.confidence >= 0.7,
    defamation_risk: combinedRisk,
    defamation_reasons: combinedReasons,
    held: stillHeld
  };

  const { error: updateErr } = await db
    .from("reports")
    .update(update)
    .eq("id", reportId);

  if (updateErr) {
    return Response.json(
      { ok: false, error: "Could not save. Try again." },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    held: stillHeld,
    risk: combinedRisk
  });
}
