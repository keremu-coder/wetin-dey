export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Auto-stop sweep. Flips location_stopped = true on every signal whose
 * expires_at has passed. Called by Vercel cron every 15 minutes.
 *
 * Guarded by CRON_SECRET so external callers can't trigger it. Vercel
 * sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.get("authorization") ?? "";
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const db = createServiceClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await db
      .from("radar_signals")
      .update({ location_stopped: true })
      .eq("location_sharing", true)
      .eq("location_stopped", false)
      .lt("expires_at", nowIso)
      .select("id");

    if (error) {
      console.error("[radar/sweep]", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, stopped: data?.length ?? 0 });
  } catch (err) {
    console.error("[radar/sweep]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}