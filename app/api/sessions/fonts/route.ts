import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidFontId, DEFAULT_FONT_ID } from "@/lib/fonts-registry";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const handlesParam = url.searchParams.get("handles") ?? "";

    const handles = Array.from(
      new Set(
        handlesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, 100);

    if (handles.length === 0) {
      return NextResponse.json({ fonts: {} });
    }

    const { data, error } = await sb()
      .from("sessions")
      .select("handle, font_preference")
      .in("handle", handles);

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const fonts: Record<string, string> = {};
    for (const row of (data ?? []) as Array<{
      handle: string | null;
      font_preference: string | null;
    }>) {
      if (row.handle) {
        fonts[row.handle] = isValidFontId(row.font_preference)
          ? row.font_preference
          : DEFAULT_FONT_ID;
      }
    }

    return NextResponse.json({ fonts });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}