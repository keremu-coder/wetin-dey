export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { assertNotBanned } from "@/lib/guards";

const TYPES = ["safe","home","on_way","need_help","call_me","police_stop"] as const;
type SignalType = typeof TYPES[number];

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const denied = await assertNotBanned(sid);
    if (denied) return denied;

    const body = (await req.json()) as {
      recipients?: unknown;
      type?: unknown;
      note?: unknown;
      lat?: unknown;
      lng?: unknown;
    };

    const type = body?.type;
    if (typeof type !== "string" || !TYPES.includes(type as SignalType)) {
      return NextResponse.json({ error: "invalid signal type" }, { status: 400 });
    }
    const recipients = Array.isArray(body?.recipients)
      ? (body!.recipients as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (recipients.length === 0) {
      return NextResponse.json({ error: "no recipients" }, { status: 400 });
    }
    const note = typeof body?.note === "string" ? body.note.slice(0, 200) : null;
    const lat = typeof body?.lat === "number" ? body.lat : null;
    const lng = typeof body?.lng === "number" ? body.lng : null;
    const needsLocation = type === "need_help" || type === "police_stop";

    const db = createServiceClient();

    // Only signal people I actually added.
    const { data: allowed } = await db
      .from("radar_contacts")
      .select("contact_id")
      .eq("owner_id", sid)
      .in("contact_id", recipients);
    const allowedIds = (allowed ?? []).map((r) => r.contact_id as string);
    if (allowedIds.length === 0) {
      return NextResponse.json({ error: "no valid recipients" }, { status: 400 });
    }

    const rows = allowedIds.map((rid) => ({
      sender_id: sid,
      recipient_id: rid,
      signal_type: type,
      note,
      lat: needsLocation ? lat : null,
      lng: needsLocation ? lng : null,
      location_sharing: needsLocation
    }));

    const { data: inserted, error } = await db.from("radar_signals").insert(rows).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: inserted?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}