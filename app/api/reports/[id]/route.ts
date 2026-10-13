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
  const { data, error } = await db.from("reports").select("*").eq("id", params.id).maybeSingle();
  if (error) return jsonError("no load", 500);
  if (!data) return jsonError("no dey", 404);
  const report = data as Report;
  if (!report.reviewed && report.session_id !== sessionId) {
    return jsonError("no dey", 404);
  }
  return Response.json({ report: stripSession(report) });
}
