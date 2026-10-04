import { nanoid } from "nanoid";
import { originAllowed, jsonError } from "@/lib/http";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!originAllowed(req)) return jsonError("origin blocked", 403);
  const sessionId = await getSessionId();
  if (!sessionId) return jsonError("no session", 401);

  const payload = (await req.json()) as { reason?: string };
  const reason = String(payload.reason ?? "").trim();
  if (reason.length < 3 || reason.length > 500) return jsonError("reason no correct", 400);

  const db = createServiceClient();
  const { data: report } = await db.from("reports").select("id").eq("id", params.id).maybeSingle();
  if (!report) return jsonError("no dey", 404);

  const { error } = await db.from("flags").insert({
    id: nanoid(),
    report_id: params.id,
    reason,
    session_id: sessionId,
    resolved: false
  });
  if (error) return jsonError("flag no save", 500);
  return Response.json({ ok: true });
}
