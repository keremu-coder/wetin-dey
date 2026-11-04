export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit } from "@/lib/rate-limit";
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

    // Audit finding 7: radar is life-safety. A shared carrier CGNAT
    // means one abusive session on the same IP could block another
    // user's live location updates. Key on session only — no IP
    // bucket — so a Radar signal in progress cannot be starved by a
    // neighbour's traffic.
    const limit = await checkRateLimit(
      sid,
      { key: "radar_update_location", limit: 20, windowMs: 60000 }
    );
    if (!limit.ok) {
      return NextResponse.json({ error: "Slow down — too many requests." }, { status: 429 });
    }

    const body = (await req.json()) as { lat?: unknown; lng?: unknown };
    const lat = body?.lat;
    const lng = body?.lng;
    if (!isValidLatLng(lat, lng)) {
      return NextResponse.json({ error: "valid lat and lng required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Audit finding: the previous query accepted location updates for
    // any signal whose location_sharing was still true - including
    // signals past their expires_at, up to 15 minutes of drift until
    // the sweep job runs (and indefinitely if the sweep dies).
    //
    // Adding the expires_at check here makes the 4-hour expiry
    // literally enforced by the endpoint itself: a client that keeps
    // sending coordinates after expiry gets a no-op update, not a
    // fresh lat/lng. The sweep job still flips location_sharing and
    // nulls coordinates - this route just stops accepting new ones.
    const { error } = await db
      .from("radar_signals")
      .update({ lat, lng, location_updated_at: new Date().toISOString() })
      .eq("sender_id", sid)
      .eq("location_sharing", true)
      .eq("location_stopped", false)
      .gt("expires_at", new Date().toISOString())
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