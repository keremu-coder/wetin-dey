export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import { isValidFontId, DEFAULT_FONT_ID } from "@/lib/fonts-registry";

/**
 * GET: Public read of a session's font preference by query param.
 * POST: Only the owning session can change their font.
 *       This used to accept session_id from the request body.
 */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id required" },
        { status: 400 }
      );
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from("sessions")
      .select("font_preference")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const font = isValidFontId(data?.font_preference)
      ? data!.font_preference
      : DEFAULT_FONT_ID;

    return NextResponse.json({ font });
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
      { key: "settings_font", limit: 30, windowMs: 60000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many requests." }, { status: 429 });
    }

    const body = (await req.json()) as { font?: unknown };
    const font = body?.font;

    if (!isValidFontId(font)) {
      return NextResponse.json({ error: "Unknown font" }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("sessions")
      .update({ font_preference: font })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, font });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}