export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { bucketCoord, isValidSignalId } from "@/lib/radar";

type SignalRow = {
  id: string;
  signal_type: string;
  lat_bucket: number;
  lng_bucket: number;
  note: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const latParam = url.searchParams.get("lat");
    const lngParam = url.searchParams.get("lng");

    if (!latParam || !lngParam) {
      return Response.json(
        { error: "lat and lng required" },
        { status: 400 }
      );
    }

    const lat = Number(latParam);
    const lng = Number(lngParam);
    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return Response.json({ error: "invalid coords" }, { status: 400 });
    }

    const latBucket = bucketCoord(lat);
    const lngBucket = bucketCoord(lng);

    // Search a 3x3 grid of buckets around the user (~3 km radius).
    const db = createServiceClient();
    const threeHoursAgo = new Date(
      Date.now() - 3 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await db
      .from("radar_signals")
      .select("id, signal_type, lat_bucket, lng_bucket, note, created_at")
      .gte("lat_bucket", latBucket - 1)
      .lte("lat_bucket", latBucket + 1)
      .gte("lng_bucket", lngBucket - 1)
      .lte("lng_bucket", lngBucket + 1)
      .gte("created_at", threeHoursAgo)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      signals: (data ?? []) as SignalRow[],
      center: { latBucket, lngBucket }
    });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const body = (await req.json()) as {
      signal_type?: unknown;
      lat?: unknown;
      lng?: unknown;
      note?: unknown;
    };

    if (!isValidSignalId(body.signal_type)) {
      return Response.json({ error: "unknown signal" }, { status: 400 });
    }
    if (typeof body.lat !== "number" || typeof body.lng !== "number") {
      return Response.json(
        { error: "lat and lng required" },
        { status: 400 }
      );
    }
    if (
      body.lat < -90 ||
      body.lat > 90 ||
      body.lng < -180 ||
      body.lng > 180
    ) {
      return Response.json({ error: "invalid coords" }, { status: 400 });
    }

    const note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim().slice(0, 80)
        : null;

    const db = createServiceClient();

    // Rate limit: max 1 signal per minute per session (light touch).
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recent } = await db
      .from("radar_signals")
      .select("id")
      .eq("session_id", sessionId)
      .gte("created_at", oneMinuteAgo)
      .limit(1);

    if (recent && recent.length > 0) {
      return Response.json(
        { error: "Slow down — one signal per minute." },
        { status: 429 }
      );
    }

    const { data, error } = await db
      .from("radar_signals")
      .insert({
        session_id: sessionId,
        signal_type: body.signal_type,
        lat_bucket: bucketCoord(body.lat),
        lng_bucket: bucketCoord(body.lng),
        note
      })
      .select("id, signal_type, lat_bucket, lng_bucket, note, created_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, signal: data });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}