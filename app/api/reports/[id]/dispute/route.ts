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

  const payload = (await req.json()) as {
    claimant_name?: string;
    claimant_contact?: string;
    explanation?: string;
  };
  const claimant_name = String(payload.claimant_name ?? "").trim();
  const claimant_contact = String(payload.claimant_contact ?? "").trim();
  const explanation = String(payload.explanation ?? "").trim();
  if (claimant_name.length < 2 || claimant_name.length > 120) return jsonError("name no correct", 400);
  if (claimant_contact.length < 3 || claimant_contact.length > 200) return jsonError("contact no correct", 400);
  if (explanation.length < 20 || explanation.length > 4000) return jsonError("explanation too short", 400);

  const db = createServiceClient();
  const { data: report } = await db.from("reports").select("id").eq("id", params.id).maybeSingle();
  if (!report) return jsonError("no dey", 404);

  const { error } = await db.from("disputes").insert({
    id: nanoid(),
    report_id: params.id,
    claimant_name,
    claimant_contact,
    explanation,
    resolved: false
  });
  if (error) return jsonError("dispute no save", 500);
  return Response.json({ ok: true });
}
