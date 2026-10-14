import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      return NextResponse.json({ statuses: {} });
    }

    const { data, error } = await sb()
      .from("sessions")
      .select("handle, status_line")
      .in("handle", handles);

    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const statuses: Record<string, string> = {};
    for (const row of (data ?? []) as Array<{
      handle: string | null;
      status_line: string | null;
    }>) {
      if (row.handle && row.status_line) {
        statuses[row.handle] = row.status_line;
      }
    }

    return NextResponse.json({ statuses });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}