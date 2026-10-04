import { NextRequest } from "next/server";
import { allowPublicFeed } from "@/lib/rateLimit";
import { jsonError } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/server";
import type { PublicReport } from "@/lib/types";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0].trim() : req.ip) || "unknown";
  if (!allowPublicFeed(ip)) {
    return jsonError("rate limit", 429);
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select("id, created_at, category, agency_canonical, state, amount_kobo, summary_english, status")
    .eq("reviewed", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return jsonError("feed no load", 500);

  const reports = (data ?? []) as PublicReport[];
  return Response.json(reports, { headers: cors });
}
