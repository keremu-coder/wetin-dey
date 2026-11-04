export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/http";

const PAGE_SIZE = 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed. If CRON_SECRET is unset in any environment, deny
  // the request rather than letting anyone hit a privileged endpoint.
  // Previously this returned true, which meant an unset secret opened
  // the endpoint to the public.
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET is not set - refusing request on " +
      req.url
    );
    return false;
  }
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = createServiceClient();

    let from = 0;
    const all: unknown[] = [];

    while (true) {
      const { data, error } = await db
        .from("reports")
        .select(
          "id, created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo, status, summary_pidgin, summary_english, incident_date, evidence_type, evidence_link, evidence_label, post_type, author_handle, upvotes, downvotes, me_too_count, comment_count, evidence_tier"
        )
        .eq("reviewed", true)
        .eq("held", false)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return Response.json({ error: "Server error" }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const payload = {
      archive_version: "1.0",
      exported_at: new Date().toISOString(),
      source: "https://wetindey.app",
      license: "Public domain. Attribution appreciated: Wetin Dey",
      count: all.length,
      reports: all
    };

    const json = JSON.stringify(payload, null, 2);

    // Persist to the private archive-export bucket. The cron caller
    // discards the response body, so without this the daily job would
    // do the work and produce no artifact. Best-effort: a persistence
    // failure does not block the download response.
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const path = `wetindey-${stamp}.json`;
      await db.storage
        .from("archive-export")
        .upload(path, new Blob([json], { type: "application/json" }), {
          contentType: "application/json",
          upsert: true
        });
    } catch (persistErr) {
      console.error("[archive/export] persist failed:", persistErr);
    }

    return new Response(json, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="wetindey-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`
      }
    });
  } catch (e) {
    return serverError("archive/export", e);
  }
}