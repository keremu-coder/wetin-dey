import { NextRequest } from "next/server";
import { checkIpRateLimit } from "@/lib/rate-limit";
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
  // IP-scoped rate limit on the public JSON feed. 120 requests per
  // 15 minutes per IP — generous for real readers, hostile to scrapers.
  const limit = await checkIpRateLimit(req, {
    key: "public_reports_json",
    limit: 120,
    windowMs: 15 * 60 * 1000
  });
  if (!limit.ok) {
    return jsonError("rate limit", 429);
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select("id, created_at, category, agency_canonical, state, amount_kobo, summary_english, status")
    .eq("reviewed", true)
    // A report hidden by a moderator is held=true. Without this filter the
    // public JSON feed kept serving reports after a takedown.
    .eq("held", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return jsonError("feed no load", 500);

  const reports = (data ?? []) as PublicReport[];
  return Response.json(reports, { headers: cors });
}