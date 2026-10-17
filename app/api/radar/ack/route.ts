export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

/**
 * Two callers:
 *   - Recipient acknowledges a signal: sets acknowledged_at, note, optionally stops location.
 *   - Sender taps "I'm safe" on their own signal: sets location_stopped=true only.
 * Both roles must match the row (recipient_id or sender_id == my session).
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

    const limit = await checkRateLimit(
      sid,
      { key: "radar_ack", limit: 30, windowMs: 60000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return NextResponse.json({ error: "Slow down — too many requests." }, { status: 429 });
    }

    const body = (await req.json()) as { id?: unknown; note?: unknown; stopLocation?: unknown };
    const id = typeof body?.id === "string" ? body.id : null;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const note = typeof body?.note === "string" ? body.note.slice(0, 200) : null;
    const stopLocation = body?.stopLocation === true;

    const db = createServiceClient();

    // Look up the row to know my role.
    const { data: row } = await db
      .from("radar_signals")
      .select("sender_id, recipient_id, signal_type")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    const isSender = row.sender_id === sid;
    const isRecipient = row.recipient_id === sid;
    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: "not allowed" }, { status: 403 });
    }

    // Sender "I'm safe": stop location sharing, do NOT ack.
    if (isSender && !isRecipient) {
      const { error } = await db
        .from("radar_signals")
        .update({ location_stopped: true })
        .eq("id", id)
        .eq("sender_id", sid);
      if (error) {
        console.error("[radar/ack sender-stop]", error.message);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, stopped: true });
    }

    // Recipient ack path (also handles sender-acks-own if that ever happens).
    const patch: Record<string, unknown> = {
      acknowledged_at: new Date().toISOString(),
      acknowledged_note: note
    };
    if (stopLocation) patch.location_stopped = true;

    const { error } = await db
      .from("radar_signals")
      .update(patch)
      .eq("id", id)
      .eq("recipient_id", sid);
    if (error) {
      console.error("[radar/ack]", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[radar/ack]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}