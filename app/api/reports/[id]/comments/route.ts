import { nanoid } from "nanoid";
import { originAllowed, jsonError } from "@/lib/http";
import { allowComment } from "@/lib/rateLimit";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Comment } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sessionId = await getSessionId();
  const db = createServiceClient();
  const { data: report } = await db.from("reports").select("id, reviewed, session_id").eq("id", params.id).maybeSingle();
  if (!report) return jsonError("no dey", 404);
  if (!report.reviewed && report.session_id !== sessionId) return jsonError("no dey", 404);

  const { data, error } = await db
    .from("comments")
    .select("id, report_id, created_at, body, reviewed, hidden")
    .eq("report_id", params.id)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return jsonError("comments no load", 500);
  return Response.json({ comments: (data ?? []) as Comment[] });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!originAllowed(req)) return jsonError("origin blocked", 403);
  const sessionId = await getSessionId();
  if (!sessionId) return jsonError("no session", 401);
  if (!allowComment(sessionId)) return jsonError("slow down — too many comments this hour", 429);

  const payload = (await req.json()) as { body?: string };
  const body = String(payload.body ?? "").trim();
  if (body.length < 1 || body.length > 2000) return jsonError("comment no correct", 400);

  const db = createServiceClient();
  const { data: report } = await db.from("reports").select("id, reviewed, session_id").eq("id", params.id).maybeSingle();
  if (!report) return jsonError("no dey", 404);
  if (!report.reviewed && report.session_id !== sessionId) return jsonError("no dey", 404);

  const { data, error } = await db
    .from("comments")
    .insert({
      id: nanoid(),
      report_id: params.id,
      body,
      session_id: sessionId,
      reviewed: false,
      hidden: false
    })
    .select("id, report_id, created_at, body, reviewed, hidden")
    .single();

  if (error) {
    if (String(error.message).toLowerCase().includes("rate limit")) {
      return jsonError("slow down — too many comments this hour", 429);
    }
    return jsonError("comment no save", 500);
  }

  return Response.json({ comment: stripSession(data as Comment) }, { status: 201 });
}
