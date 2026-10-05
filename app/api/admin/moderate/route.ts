export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { originAllowed, jsonError } from "@/lib/http";

async function requireAdmin(sessionId: string | null): Promise<boolean> {
  if (!sessionId) return false;
  const db = createServiceClient();
  const { data } = await db
    .from("admins")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  return !!data;
}

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return jsonError("origin blocked", 403);

  const sessionId = await getSessionId();
  if (!(await requireAdmin(sessionId))) {
    return jsonError("not authorized", 403);
  }

  let body: { report_id?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("bad json", 400);
  }

  const reportId = String(body.report_id ?? "");
  const action = String(body.action ?? "");
  const note = String(body.note ?? "");

  if (!reportId || !action) {
    return jsonError("report_id and action required", 400);
  }

  const db = createServiceClient();

  if (action === "approve") {
    const { error } = await db
      .from("reports")
      .update({ reviewed: true, reviewer_note: note || null })
      .eq("id", reportId);
    if (error) return jsonError(error.message, 500);
  } else if (action === "dispute") {
    const { error } = await db
      .from("reports")
      .update({ status: "disputed", reviewer_note: note || null })
      .eq("id", reportId);
    if (error) return jsonError(error.message, 500);
  } else if (action === "hide") {
    const { error } = await db
      .from("reports")
      .update({ reviewed: true, reviewer_note: note || "hidden" })
      .eq("id", reportId);
    if (error) return jsonError(error.message, 500);
  } else {
    return jsonError("unknown action", 400);
  }

  await db.from("moderation_actions").insert({
    report_id: reportId,
    action,
    moderator_note: note || null
  });

  return Response.json({ ok: true });
}