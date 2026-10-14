import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidFontId, DEFAULT_FONT_ID } from "@/lib/fonts-registry";

export const runtime = "nodejs";

/**
 * Service-role client. Fails loud if SUPABASE_SERVICE_ROLE_KEY is missing.
 *
 * Previously this fell back to the anon key with `||`, which would
 * silently downgrade a production route to a lower-privilege client if
 * the service key was ever unset. Because the anon grant on sessions is
 * revoked (see migration 013), that fallback would return empty results
 * instead of an error — a silent breakage, not a visible one. Fail loud.
 */
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
      return NextResponse.json(
        { fonts: {}, statuses: {} },
        {
          headers: {
            // Cache for 30s — chat opens in the same session re-use this
            "Cache-Control": "private, max-age=30"
          }
        }
      );
    }

    const { data, error } = await sb()
      .from("sessions")
      .select("handle, font_preference, status_line")
      .in("handle", handles);

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const fonts: Record<string, string> = {};
    const statuses: Record<string, string> = {};

    for (const row of (data ?? []) as Array<{
      handle: string | null;
      font_preference: string | null;
      status_line: string | null;
    }>) {
      if (!row.handle) continue;
      fonts[row.handle] = isValidFontId(row.font_preference)
        ? row.font_preference
        : DEFAULT_FONT_ID;
      if (row.status_line) {
        statuses[row.handle] = row.status_line;
      }
    }

    return NextResponse.json(
      { fonts, statuses },
      {
        headers: {
          "Cache-Control": "private, max-age=30"
        }
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}