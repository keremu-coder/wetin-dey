export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { assertNotBanned } from "@/lib/guards";

/**
 * Register a native push token (APNs on iOS, FCM on Android).
 *
 * Called by PushRegistrar after @capacitor/push-notifications emits a
 * "registration" event. Tokens are unique; upsert replaces an existing
 * row for the same token so the same device re-registering under a
 * different session doesn't duplicate.
 */
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

    const body = (await req.json()) as {
      platform?: unknown;
      token?: unknown;
    };

    if (body.platform !== "ios" && body.platform !== "android") {
      return NextResponse.json(
        { error: "platform must be ios or android" },
        { status: 400 }
      );
    }
    if (typeof body.token !== "string" || body.token.length < 10) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("native_push_tokens")
      .upsert(
        {
          session_id: sessionId,
          platform: body.platform,
          token: body.token
        },
        { onConflict: "token" }
      );

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[native-subscribe]", e);
    console.error("[route-error]", e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

/**
 * Unregister a native push token. Only the owning session can delete.
 */
export async function DELETE(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return NextResponse.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }

    const body = (await req.json()) as { token?: unknown };
    if (typeof body.token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("native_push_tokens")
      .delete()
      .eq("token", body.token)
      .eq("session_id", sessionId);

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[native-subscribe DELETE]", e);
    console.error("[route-error]", e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}