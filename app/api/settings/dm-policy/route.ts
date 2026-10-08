export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";

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
    return Response.json(
      { error: "Server error: " + (e as Error).message },
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
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, policy: body.policy });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}