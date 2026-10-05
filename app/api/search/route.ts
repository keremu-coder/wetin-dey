export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/^@/, "");
  if (!q || q.length < 2) {
    return Response.json({ users: [] });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("sessions")
    .select("handle, handle_kind, follower_count, post_count")
    .ilike("handle", `%${q}%`)
    .limit(20);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ users: data ?? [] });
}