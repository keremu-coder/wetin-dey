export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertNotBanned } from "@/lib/guards";
import { isValidLatLng } from "@/lib/geo";
import { sendPushToSessions } from "@/lib/push-server";

const TYPES = ["safe","home","on_way","need_help","call_me","police_stop"] as const;
type SignalType = typeof TYPES[number];

const PUSH_COPY: Record<SignalType, { title: string; body: string }> = {
  safe:         { title: "\u2713 I dey safe",       body: "Let you know say e don land" },
  home:         { title: "\u2302 I don reach house",  body: "Dey house now" },
  on_way:       { title: "\u2192 On the way",          body: "Coming now" },
  need_help:    { title: "\u26A0 I need help",         body: "Urgent \u2014 share the location" },
  call_me:      { title: "\u260E Call me",              body: "Ping, no text needed" },
  police_stop:  { title: "\u26A0 Police stop",          body: "Urgent \u2014 stay close" }
};

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const denied = await assertNotBanned(sid);
    if (denied) return denied;

    // Radar is high-signal: cap at 20 sends per hour per session.
    const limit = await checkRateLimit(sid, {
      key: "radar_send",
      limit: 20,
      windowMs: 60 * 60 * 1000
    }, { ip: getRequestIp(req) });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many signals. Wait and try again." },
        { status: 429 }
      );
    }

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
    const needsLocation = type === "need_help" || type === "police_stop";
    const hasCoords = isValidLatLng(body?.lat, body?.lng);
    if (needsLocation && body?.lat != null && !hasCoords) {
      return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
    }
    const lat = hasCoords ? (body.lat as number) : null;
    const lng = hasCoords ? (body.lng as number) : null;

    const db = createServiceClient();

    // Only signal people I actually added, capped at 20 per send.
    const { data: allowed } = await db
      .from("radar_contacts")
      .select("contact_id")
      .eq("owner_id", sid)
      .in("contact_id", recipients.slice(0, 20));
    const iAdded = (allowed ?? []).map((r) => r.contact_id as string);

    // Mutual consent: a recipient only receives a signal if they have
    // also added the sender back. Stops unsolicited pings and stalking.
    const { data: reciprocal } = iAdded.length
      ? await db
          .from("radar_contacts")
          .select("owner_id")
          .eq("contact_id", sid)
          .in("owner_id", iAdded)
      : { data: [] as Array<{ owner_id: string }> };
    const allowedIds = (reciprocal ?? []).map((r) => r.owner_id as string);
    if (allowedIds.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients. They must add you back first." },
        { status: 400 }
      );
    }

    const rows = allowedIds.map((rid) => ({
      sender_id: sid,
      recipient_id: rid,
      signal_type: type,
      note,
      lat: needsLocation ? lat : null,
      lng: needsLocation ? lng : null,
      location_sharing: needsLocation,
      expires_at: needsLocation
        ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        : null
    }));

    const { data: inserted, error } = await db.from("radar_signals").insert(rows).select("id");
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 });

    // Push to each recipient. Fires concurrently. Fails silently so a
    // missing token never blocks the signal itself.
    try {
      const senderRes = await db.from("sessions").select("handle").eq("id", sid).maybeSingle();
      const senderHandle = senderRes.data?.handle ?? "Someone";
      const copy = PUSH_COPY[type as SignalType];
      const firstId = (inserted?.[0] as { id?: string } | undefined)?.id ?? String(Date.now());
      await sendPushToSessions(allowedIds, {
        title: copy.title,
        body: "@" + senderHandle + " \u2014 " + copy.body,
        tag: "radar-" + firstId,
        url: "/radar"
      });
    } catch (e) {
      console.error("[radar/send] push failed:", e);
    }

    return NextResponse.json({ ok: true, count: inserted?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}