import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidFontId, DEFAULT_FONT_ID } from "@/lib/bbm-fonts";

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
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const { data, error } = await sb()
      .from("sessions")
      .select("font_preference")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const font = isValidFontId(data?.font_preference)
      ? data!.font_preference
      : DEFAULT_FONT_ID;

    return NextResponse.json({ font });
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
      font?: unknown;
    };

    const sessionId = body?.session_id;
    const font = body?.font;

    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }
    if (!isValidFontId(font)) {
      return NextResponse.json({ error: "Unknown font" }, { status: 400 });
    }

    const { error } = await sb()
      .from("sessions")
      .update({ font_preference: font })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, font });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}