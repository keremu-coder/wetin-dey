export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { todayPrompt } from "@/lib/daily-prompts";
import { assertCanWrite } from "@/lib/guards";
import { serverError } from "@/lib/http";

export async function GET() {
  try {
    const { id: promptId, date } = todayPrompt();
    const sessionId = await getSessionId();
    const db = createServiceClient();

    const [countResult, mineResult] = await Promise.all([
      db
        .from("daily_answers")
        .select("id", { count: "exact", head: true })
        .eq("answer_date", date),
      sessionId
        ? db
            .from("daily_answers")
            .select("id, body, created_at")
            .eq("answer_date", date)
            .eq("session_id", sessionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    return Response.json({
      prompt: todayPrompt(),
      answer_count: countResult.count ?? 0,
      my_answer: mineResult.data ?? null
    });
  } catch (e) {
    return serverError("daily", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const body = (await req.json()) as { body?: unknown };
    if (typeof body.body !== "string") {
      return Response.json({ error: "body required" }, { status: 400 });
    }

    const text = body.body.trim();
    if (text.length < 1) {
      return Response.json({ error: "Empty" }, { status: 400 });
    }
    if (text.length > 280) {
      return Response.json(
        { error: "Max 280 characters" },
        { status: 400 }
      );
    }

    const { id: promptId, date } = todayPrompt();
    const db = createServiceClient();

    const { data, error } = await db
      .from("daily_answers")
      .upsert(
        {
          prompt_id: promptId,
          answer_date: date,
          session_id: sessionId,
          body: text
        },
        { onConflict: "session_id,answer_date" }
      )
      .select("id, body, created_at")
      .single();

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    const { count } = await db
      .from("daily_answers")
      .select("id", { count: "exact", head: true })
      .eq("answer_date", date);

    return Response.json({
      ok: true,
      answer: data,
      answer_count: count ?? 0
    });
  } catch (e) {
    return serverError("daily", e);
  }
}