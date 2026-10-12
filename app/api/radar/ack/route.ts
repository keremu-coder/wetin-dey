export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const body = (await req.json()) as { id?: unknown; note?: unknown; stopLocation?: unknown };
    const id = typeof body?.id === "string" ? body.id : null;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const note = typeof body?.note === "string" ? body.note.slice(0, 200) : null;
    const stopLocation = body?.stopLocation === true;

    const db = createServiceClient();
    const patch: Record<string, unknown> = {
      acknowledged_at: new Date().toISOString(),
      acknowledged_note: note
    };
    if (stopLocation) patch.location_stopped = true;

    const { error } = await db.from("radar_signals").update(patch).eq("id", id).eq("recipient_id", sid);
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}