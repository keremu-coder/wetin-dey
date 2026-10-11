export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { validateHandle, cooldownDaysLeft } from "@/lib/handle-rules";
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
      .select("handle, handle_changed_at, previous_handles")
      .eq("id", sessionId)
      .maybeSingle();

    if (!data) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const daysLeft = cooldownDaysLeft(data.handle_changed_at);

    return Response.json({
      handle: data.handle,
      previous_handles: data.previous_handles ?? [],
      handle_changed_at: data.handle_changed_at ?? null,
      cooldown_days_left: daysLeft
    });
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

    const limit = await checkRateLimit(sessionId, {
      key: "handle_change",
      limit: 5,
      windowMs: 60 * 60 * 1000
    }, { ip: getRequestIp(req) });
    if (!limit.ok) {
      return Response.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { handle?: unknown };
    if (typeof body.handle !== "string") {
      return Response.json({ error: "handle required" }, { status: 400 });
    }

    const check = validateHandle(body.handle);
    if (!check.ok) {
      return Response.json({ error: check.reason }, { status: 400 });
    }

    const db = createServiceClient();

    const { data: me } = await db
      .from("sessions")
      .select("id, handle, handle_changed_at, previous_handles")
      .eq("id", sessionId)
      .maybeSingle();

    if (!me) {
      return Response.json({ error: "profile not found" }, { status: 404 });
    }

    if (me.handle === check.normalized) {
      return Response.json({ ok: true, handle: me.handle, noop: true });
    }

    const daysLeft = cooldownDaysLeft(me.handle_changed_at);
    if (daysLeft > 0) {
      return Response.json(
        {
          error: `You can change your handle again in ${daysLeft} day${
            daysLeft === 1 ? "" : "s"
          }.`
        },
        { status: 429 }
      );
    }

    const { data: takenCurrent } = await db
      .from("sessions")
      .select("id")
      .eq("handle", check.normalized)
      .maybeSingle();

    if (takenCurrent && takenCurrent.id !== sessionId) {
      return Response.json(
        { error: "That handle is already taken." },
        { status: 409 }
      );
    }

    const { data: takenPrevious } = await db
      .from("sessions")
      .select("id")
      .contains("previous_handles", [check.normalized])
      .maybeSingle();

    if (takenPrevious && takenPrevious.id !== sessionId) {
      return Response.json(
        { error: "That handle was used before and is no longer available." },
        { status: 409 }
      );
    }

    const prevList: string[] = Array.isArray(me.previous_handles)
      ? me.previous_handles
      : [];
    const nextPrev = prevList.includes(me.handle)
      ? prevList
      : [...prevList, me.handle];

    const { error: updateErr } = await db
      .from("sessions")
      .update({
        handle: check.normalized,
        previous_handles: nextPrev,
        handle_changed_at: new Date().toISOString()
      })
      .eq("id", sessionId);

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500 });
    }

    return Response.json({ ok: true, handle: check.normalized });
  } catch (e) {
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}