export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import { isValidStatus, normalizeStatus } from "@/lib/status";
import { isValidAvailability } from "@/lib/presence";

/**
 * GET: Public read of a session's status line by query param.
 *      (Anyone can view anyone's status. It's public profile data.)
 *
 * POST: Only the owning session can change their own status.
 *       This used to accept session_id from the request body, which
 *       meant any caller could change any user's status. Now it uses
 *       the signed session cookie.
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
      .select("status_line, status_line_updated_at, availability")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      status_line: data?.status_line ?? null,
      status_line_updated_at: data?.status_line_updated_at ?? null,
      availability: data?.availability ?? "auto"
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
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

    const body = (await req.json()) as {
      status_line?: unknown;
      availability?: unknown;
    };
    const rawStatus = body?.status_line;
    const rawAvailability = body?.availability;

    const update: Record<string, unknown> = {};

    if (rawStatus !== undefined) {
      const isClearing =
        rawStatus === null ||
        rawStatus === "" ||
        (typeof rawStatus === "string" && rawStatus.trim() === "");

      if (isClearing) {
        update.status_line = null;
        update.status_line_updated_at = new Date().toISOString();
      } else if (isValidStatus(rawStatus)) {
        update.status_line = normalizeStatus(rawStatus);
        update.status_line_updated_at = new Date().toISOString();
      } else {
        return NextResponse.json(
          { error: "Status must be 1–60 characters." },
          { status: 400 }
        );
      }
    }

    if (rawAvailability !== undefined) {
      if (!isValidAvailability(rawAvailability)) {
        return NextResponse.json(
          { error: "Unknown availability." },
          { status: 400 }
        );
      }
      update.availability = rawAvailability;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 }
      );
    }

    const db = createServiceClient();
    const { error } = await db
      .from("sessions")
      .update(update)
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...update });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}