export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
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

// GET returns the caller's own status via the signed session cookie.
//
// Audit finding 3c: the previous version accepted ?session_id= and
// returned that session's status to anyone. That made the endpoint a
// session-id oracle — an attacker who obtained session ids elsewhere
// (see finding 2) could probe this to confirm a session's existence
// and read their status. There is no client that actually needs to
// read *another* session's status by id: profile pages read
// status_line directly from the sessions row server-side, and the
// settings page reads its own status. So we drop the query param
// entirely.
export async function GET(_req: NextRequest) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from("sessions")
      .select("status_line, status_line_updated_at, availability")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({
      status_line: data?.status_line ?? null,
      status_line_updated_at: data?.status_line_updated_at ?? null,
      availability: data?.availability ?? "auto"
    });
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
      { key: "settings_status", limit: 30, windowMs: 60000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many requests." }, { status: 429 });
    }

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
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...update });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}