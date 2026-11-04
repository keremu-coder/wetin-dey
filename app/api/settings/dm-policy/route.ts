export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import { serverError } from "@/lib/http";

const VALID = ["everyone", "following"] as const;
type Policy = (typeof VALID)[number];

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();
    const { data } = await db
      .from("sessions")
      .select("dm_policy")
      .eq("id", sessionId)
      .maybeSingle();

    const policy: Policy =
      data?.dm_policy === "following" ? "following" : "everyone";

    return Response.json({ policy });
  } catch (e) {
    return serverError("settings/dm-policy", e);
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

    const limit = await checkRateLimit(
      sessionId,
      { key: "settings_dm_policy", limit: 30, windowMs: 60000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many requests." }, { status: 429 });
    }

    const body = (await req.json()) as { policy?: unknown };
    if (
      typeof body.policy !== "string" ||
      !VALID.includes(body.policy as Policy)
    ) {
      return Response.json({ error: "invalid policy" }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("sessions")
      .update({ dm_policy: body.policy })
      .eq("id", sessionId);

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({ ok: true, policy: body.policy });
  } catch (e) {
    return serverError("settings/dm-policy", e);
  }
}