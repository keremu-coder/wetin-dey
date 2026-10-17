export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertNotBanned } from "@/lib/guards";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return NextResponse.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertNotBanned(sessionId);
    if (denied) return denied;

    const limit = await checkRateLimit(
      sessionId,
      { key: "push_subscribe", limit: 10, windowMs: 3600000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return NextResponse.json({ error: "Slow down — try again later." }, { status: 429 });
    }

    const body = (await req.json()) as {
      endpoint?: unknown;
      p256dh?: unknown;
      auth?: unknown;
      user_agent?: unknown;
    };

    if (
      typeof body.endpoint !== "string" ||
      typeof body.p256dh !== "string" ||
      typeof body.auth !== "string"
    ) {
      return NextResponse.json(
        { error: "endpoint, p256dh, auth required" },
        { status: 400 }
      );
    }

    const db = createServiceClient();
    const { error } = await db
      .from("push_subscriptions")
      .upsert(
        {
          session_id: sessionId,
          endpoint: body.endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
          user_agent:
            typeof body.user_agent === "string" ? body.user_agent : null,
          last_seen_at: new Date().toISOString()
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return NextResponse.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }

    const body = (await req.json()) as { endpoint?: unknown };
    if (typeof body.endpoint !== "string") {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Only delete the caller's own subscription. Filtering on session_id
    // prevents someone with a leaked endpoint URL from silencing another
    // user's notifications.
    const { error } = await db
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", body.endpoint)
      .eq("session_id", sessionId);

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}