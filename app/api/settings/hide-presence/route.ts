export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();
    const { data } = await db
      .from("sessions")
      .select("hide_presence")
      .eq("id", sessionId)
      .maybeSingle();

    return Response.json({ hide_presence: data?.hide_presence === true });
  } catch (e) {
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const body = (await req.json()) as { hide_presence?: unknown };
    if (typeof body.hide_presence !== "boolean") {
      return Response.json({ error: "boolean required" }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("sessions")
      .update({ hide_presence: body.hide_presence })
      .eq("id", sessionId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, hide_presence: body.hide_presence });
  } catch (e) {
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}