export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";

const VALID = ["private", "followers", "public"] as const;
type Tier = typeof VALID[number];

export async function GET() {
  try {
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const db = createServiceClient();
    const { data, error } = await db.from("sessions").select("photo_visibility").eq("id", sid).maybeSingle();
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 });
    const v = (data?.photo_visibility as Tier) ?? "private";
    return NextResponse.json({ visibility: VALID.includes(v) ? v : "private" });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const denied = await assertCanWrite(sid);
    if (denied) return denied;

    const limit = await checkRateLimit(
      sid,
      { key: "settings_photo_visibility", limit: 30, windowMs: 60000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many requests." }, { status: 429 });
    }
    const body = (await req.json()) as { visibility?: unknown };
    const v = body?.visibility;
    if (typeof v !== "string" || !VALID.includes(v as Tier)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const db = createServiceClient();
    const { error } = await db.from("sessions").update({ photo_visibility: v }).eq("id", sid);
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 });
    return NextResponse.json({ ok: true, visibility: v });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}