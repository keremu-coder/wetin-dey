export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { put } from "@vercel/blob";

const PAGE_SIZE = 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Manual export from the browser is allowed if no secret is configured,
  // and so is any call if the user manually navigated to /api/archive/export.
  if (!secret) return true;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = createServiceClient();

    // Fetch all reviewed, non-held reports in pages
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
        return Response.json({ error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const payload = {
      archive_version: "1.0",
      exported_at: new Date().toISOString(),
      source: "https://9jawatindey.vercel.app",
      license: "Public domain. Attribution appreciated: Wetin Dey",
      count: all.length,
      reports: all
    };

    const json = JSON.stringify(payload, null, 2);

    // If BLOB_READ_WRITE_TOKEN is configured, store it. Otherwise return it.
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        const date = new Date().toISOString().slice(0, 10);
        const blob = await put(`archive/wetindey-${date}.json`, json, {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
          token: blobToken
        });
        // Also write to a stable "latest" URL
        await put("archive/wetindey-latest.json", json, {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
          token: blobToken
        });
        return Response.json({
          ok: true,
          count: all.length,
          url: blob.url,
          latest: "/archive/wetindey-latest.json"
        });
      } catch (e) {
        return Response.json(
          {
            ok: false,
            error: "Blob write failed: " + (e as Error).message,
            count: all.length
          },
          { status: 500 }
        );
      }
    }

    // No blob token — serve the JSON directly (fine for small archives)
    return new Response(json, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="wetindey-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`
      }
    });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}