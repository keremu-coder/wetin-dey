export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { isValidLatLng } from "@/lib/geo";

/**
 * Sender-side live location update. Called every ~30s while the sender
 * has an open need_help / police_stop signal with location_sharing on.
 *
 * Updates all of the sender's unacknowledged danger signals so both
 * recipients see the same fresh coordinates.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

    const body = (await req.json()) as { lat?: unknown; lng?: unknown };
    const lat = body?.lat;
    const lng = body?.lng;
    if (!isValidLatLng(lat, lng)) {
      return NextResponse.json({ error: "valid lat and lng required" }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("radar_signals")
      .update({ lat, lng, location_updated_at: new Date().toISOString() })
      .eq("sender_id", sid)
      .eq("location_sharing", true)
      .eq("location_stopped", false)
      .in("signal_type", ["need_help", "police_stop"]);

    if (error) {
      console.error("[radar/update-location]", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[radar/update-location]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}