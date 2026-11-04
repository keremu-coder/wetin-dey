export const runtime = "nodejs";

import { nanoid } from "nanoid";
import { jsonError } from "@/lib/http";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCanWrite } from "@/lib/guards";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const sessionId = await getSessionId();
  const db = createServiceClient();
  const { data: report } = await db.from("reports").select("id, reviewed, session_id").eq("id", params.id).maybeSingle();
  if (!report) return jsonError("no dey", 404);
  if (!report.reviewed && report.session_id !== sessionId) return jsonError("no dey", 404);

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

  return Response.json({ count: count ?? 0, mine });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  if (!sameOrigin(req)) return jsonError("origin blocked", 403);
  const sessionId = await getSessionId();
  if (!sessionId) return jsonError("no session", 401);

  const denied = await assertCanWrite(sessionId);
  if (denied) return denied;

  const limit = await checkRateLimit(
    sessionId,
    {
      key: "me_too",
      limit: 30,
      windowMs: 60 * 1000
    },
    { ip: getRequestIp(req) }
  );

  if (!limit.ok) {
    return jsonError("slow down — too many requests", 429);
  }

  const db = createServiceClient();
  const { data: report } = await db.from("reports").select("id, reviewed, session_id").eq("id", params.id).maybeSingle();
  if (!report) return jsonError("no dey", 404);
  if (!report.reviewed && report.session_id !== sessionId) return jsonError("no dey", 404);

  const { error } = await db.from("me_toos").insert({
    id: nanoid(),
    report_id: params.id,
    session_id: sessionId
  });

  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    return jsonError("no fit add me-too", 500);
  }

  const { count } = await db
    .from("me_toos")
    .select("id", { count: "exact", head: true })
    .eq("report_id", params.id);

  return Response.json({ count: count ?? 0, mine: true });
}
