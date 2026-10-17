export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import { isValidTextColorId, DEFAULT_TEXT_COLOR_ID } from "@/lib/text-colors";

/**
 * GET: Public read of a session's text color by query param.
 * POST: Only the owning session can change their color.
 */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from("sessions")
      .select("text_color")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const color = isValidTextColorId(data?.text_color)
      ? data!.text_color
      : DEFAULT_TEXT_COLOR_ID;

    return NextResponse.json({ color });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return NextResponse.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const limit = await checkRateLimit(
      sessionId,
      { key: "settings_textcolor", limit: 30, windowMs: 60000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many requests." }, { status: 429 });
    }

    const body = (await req.json()) as { color?: unknown };
    const color = body?.color;

    if (!isValidTextColorId(color)) {
      return NextResponse.json({ error: "Unknown color" }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("sessions")
      .update({ text_color: color })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, color });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}