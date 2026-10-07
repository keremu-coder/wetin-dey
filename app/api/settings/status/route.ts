import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidStatus, normalizeStatus } from "@/lib/status";
import { isValidAvailability } from "@/lib/presence";

export const runtime = "nodejs";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id required" },
        { status: 400 }
      );
    }
    const { data, error } = await sb()
      .from("sessions")
      .select("status_line, status_line_updated_at, availability")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      status_line: data?.status_line ?? null,
      status_line_updated_at: data?.status_line_updated_at ?? null,
      availability: data?.availability ?? "auto"
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      session_id?: unknown;
      status_line?: unknown;
      availability?: unknown;
    };
    const sessionId = body?.session_id;
    const rawStatus = body?.status_line;
    const rawAvailability = body?.availability;

    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json(
        { error: "session_id required" },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {};

    // Status line is optional in this call — only touch it if the caller
    // sent the field.
    if (rawStatus !== undefined) {
      const isClearing =
        rawStatus === null ||
        rawStatus === "" ||
        (typeof rawStatus === "string" && rawStatus.trim() === "");

      if (isClearing) {
        update.status_line = null;
        update.status_line_updated_at = new Date().toISOString();
      } else if (isValidStatus(rawStatus)) {
        update.status_line = normalizeStatus(rawStatus);
        update.status_line_updated_at = new Date().toISOString();
      } else {
        return NextResponse.json(
          { error: "Status must be 1–60 characters." },
          { status: 400 }
        );
      }
    }

    if (rawAvailability !== undefined) {
      if (!isValidAvailability(rawAvailability)) {
        return NextResponse.json(
          { error: "Unknown availability." },
          { status: 400 }
        );
      }
      update.availability = rawAvailability;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 }
      );
    }

    const { error } = await sb()
      .from("sessions")
      .update(update)
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...update });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}