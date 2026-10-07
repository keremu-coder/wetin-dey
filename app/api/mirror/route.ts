export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  telegramConfigured,
  postReportToTelegram
} from "@/lib/telegram";

const BATCH_SIZE = 5;
const BASE_URL = "https://9jawatindey.vercel.app";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!telegramConfigured()) {
    return Response.json({
      ok: false,
      skipped: true,
      reason: "Telegram env vars not set"
    });
  }

  try {
    const db = createServiceClient();

    const { data: pending, error } = await db
      .from("reports")
      .select(
        "id, created_at, state, category, post_type, agency_canonical, agency_raw, summary_pidgin, summary_english, amount_kobo, body, community_id"
      )
      .eq("reviewed", true)
      .is("mirrored_to_telegram_at", null)
      .is("community_id", null)
      .in("post_type", ["report_am", "ask", "help"])
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const rows = pending ?? [];
    if (rows.length === 0) {
      return Response.json({ ok: true, posted: 0, remaining: 0 });
    }

    let posted = 0;
    const failedIds: string[] = [];

    for (const r of rows) {
      const title =
        r.agency_canonical ||
        r.agency_raw ||
        (r.category ? `Report · ${r.category}` : "Civic report");
      const summary =
        r.summary_pidgin || r.summary_english || r.body?.slice(0, 400) || "";
      const publicUrl = `${BASE_URL}/r/${r.id}`;

      const ok = await postReportToTelegram({
        id: r.id,
        title,
        agency: r.agency_canonical || r.agency_raw || "Unknown agency",
        state: r.state ?? "Nigeria",
        summary,
        amount_kobo: r.amount_kobo,
        publicUrl
      });

      if (ok) {
        posted += 1;
        await db
          .from("reports")
          .update({ mirrored_to_telegram_at: new Date().toISOString() })
          .eq("id", r.id);
      } else {
        failedIds.push(r.id);
      }

      await new Promise((res) => setTimeout(res, 500));
    }

    const { count } = await db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reviewed", true)
      .is("mirrored_to_telegram_at", null)
      .is("community_id", null)
      .in("post_type", ["report_am", "ask", "help"]);

    return Response.json({
      ok: true,
      posted,
      failed: failedIds.length,
      remaining: count ?? 0
    });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}