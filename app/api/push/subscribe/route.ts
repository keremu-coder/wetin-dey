import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionId } from "@/lib/session";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
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

    const { error } = await sb()
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { endpoint?: unknown };
    if (typeof body.endpoint !== "string") {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    const { error } = await sb()
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", body.endpoint);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}