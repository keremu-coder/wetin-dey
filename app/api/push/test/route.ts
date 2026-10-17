import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { sendPushToSessions } from "@/lib/push-server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }

    const limit = await checkRateLimit(
      sessionId,
      { key: "push_test", limit: 5, windowMs: 3600000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return NextResponse.json({ error: "Slow down — try again later." }, { status: 429 });
    }

    await sendPushToSessions([sessionId], {
      title: "Wetin Dey",
      body: "Push notifications dey work. 🎉",
      tag: "test",
      url: "/"
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}