import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { sendPushToSessions } from "@/lib/push-server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
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
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}