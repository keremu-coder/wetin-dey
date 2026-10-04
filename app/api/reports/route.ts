export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { CATEGORIES, NIGERIA_STATES, PAGE_SIZE } from "@/lib/constants";
import { stripExifServer } from "@/lib/exif";
import { originAllowed, jsonError } from "@/lib/http";
import { allowReport, hashDedupe } from "@/lib/rateLimit";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const state = searchParams.get("state");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const agency = searchParams.get("agency");
  const status = searchParams.get("status");

  const db = createServiceClient();
  let q = db
    .from("reports")
    .select(
      "id, created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo, evidence_url, summary_pidgin, summary_english, incident_date, status, reviewed, reviewer_note, formalization_confidence, dedupe_hash"
    )
    .eq("reviewed", true)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (state) q = q.eq("state", state);
  if (category) q = q.eq("category", category);
  if (agency) q = q.eq("agency_canonical", agency);
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data, error } = await q;
  if (error) return jsonError("feed no load", 500);
  return Response.json({ reports: data ?? [] });
}

export async function POST(req: NextRequest) {
  console.log("=== POST /api/reports START ===");

  // 1. Origin check
  const originOk = originAllowed(req);
  console.log("[1] origin allowed:", originOk, "| origin:", req.headers.get("origin"));
  if (!originOk) return jsonError("origin blocked", 403);

  // 2. Session check
  let sessionId: string | null = null;
  try {
    sessionId = await getSessionId();
    console.log("[2] sessionId:", sessionId ? sessionId.slice(0, 8) + "..." : "NULL");
  } catch (e) {
    console.error("[2] getSessionId THREW:", e);
    return jsonError("session error: " + (e as Error).message, 500);
  }
  if (!sessionId) return jsonError("no session", 401);

  // 3. Rate limit check
  const rateOk = allowReport(sessionId);
  console.log("[3] rate limit ok:", rateOk);
  if (!rateOk) return jsonError("slow down — too many reports this hour", 429);

  // 4. Parse form
  let form: FormData;
  try {
    form = await req.formData();
    console.log("[4] form parsed, keys:", Array.from(form.keys()));
  } catch (e) {
    console.error("[4] formData THREW:", e);
    return jsonError("form parse error: " + (e as Error).message, 400);
  }

  const category = String(form.get("category") ?? "");
  const agency_raw = String(form.get("agency") ?? "").trim();
  const state = String(form.get("state") ?? "");
  const lga = String(form.get("lga") ?? "").trim() || null;
  const body = String(form.get("body") ?? "").trim();
  const amountRaw = String(form.get("amount") ?? "").trim();
  const anonymous =
    String(form.get("anonymous") ?? "") === "on" ||
    String(form.get("anonymous") ?? "") === "true";
  const file = form.get("evidence");

  console.log("[4] parsed values:", {
    category,
    agency_raw,
    state,
    lga,
    bodyLength: body.length,
    amountRaw,
    anonymous,
    fileIsFile: file instanceof File,
    fileSize: file instanceof File ? file.size : 0
  });

  // 5. Validate
  if (!anonymous) {
    console.error("[5] FAIL: anonymous not confirmed");
    return jsonError("you must confirm say you dey report anonymous", 400);
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    console.error("[5] FAIL: bad category:", category);
    return jsonError("category no correct", 400);
  }
  if (!NIGERIA_STATES.includes(state as (typeof NIGERIA_STATES)[number])) {
    console.error("[5] FAIL: bad state:", state);
    return jsonError("state no correct", 400);
  }
  if (agency_raw.length < 2 || agency_raw.length > 200) {
    console.error("[5] FAIL: bad agency length:", agency_raw.length);
    return jsonError("agency name no correct", 400);
  }
  if (body.length < 50 || body.length > 5000) {
    console.error("[5] FAIL: bad body length:", body.length);
    return jsonError("story must be 50–5000 characters", 400);
  }

  let amount_kobo: number | null = null;
  if (amountRaw) {
    const naira = Number(amountRaw);
    if (!Number.isFinite(naira) || naira < 0) {
      console.error("[5] FAIL: bad amount:", amountRaw);
      return jsonError("amount no correct", 400);
    }
    amount_kobo = Math.round(naira * 100);
  }

  // 6. DB client
  let db;
  try {
    db = createServiceClient();
    console.log("[6] service client created");
  } catch (e) {
    console.error("[6] createServiceClient THREW:", e);
    return jsonError("supabase client error: " + (e as Error).message, 500);
  }

  const id = nanoid();
  let evidence_url: string | null = null;

  // 7. Evidence upload (if any)
  if (file instanceof File && file.size > 0) {
    try {
      if (file.size > 8 * 1024 * 1024) {
        console.error("[7] FAIL: file too large:", file.size);
        return jsonError("photo too large", 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      console.log("[7] file buffered, bytes:", buf.length);

      const clean = await stripExifServer(buf);
      console.log("[7] EXIF stripped, bytes:", clean.length);

      const path = `${id}.jpg`;
      const up = await db.storage.from("evidence").upload(path, clean, {
        contentType: "image/jpeg",
        upsert: false
      });
      if (up.error) {
        console.error("[7] storage upload FAILED:", up.error);
        return jsonError("evidence no save: " + up.error.message, 500);
      }
      const pub = db.storage.from("evidence").getPublicUrl(path);
      evidence_url = pub.data.publicUrl;
      console.log("[7] evidence uploaded:", evidence_url);
    } catch (e) {
      console.error("[7] evidence block THREW:", e);
      return jsonError("evidence error: " + (e as Error).message, 500);
    }
  }

  // 8. Build row
  const row = {
    id,
    category,
    agency_raw,
    agency_canonical: agency_raw,
    state,
    lga,
    body,
    amount_kobo,
    evidence_url,
    status: "reported",
    reviewed: false,
    session_id: sessionId,
    dedupe_hash: hashDedupe([
      sessionId,
      category,
      agency_raw.toLowerCase(),
      state,
      body.slice(0, 200)
    ])
  };
  console.log("[8] row built:", JSON.stringify(row, null, 2));

  // 9. Insert
  const { data, error } = await db.from("reports").insert(row).select("*").single();

  if (error) {
    console.error("=== REPORT INSERT FAILED ===");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("===========================");

    if (String(error.message).toLowerCase().includes("rate limit")) {
      return jsonError("slow down — too many reports this hour", 429);
    }
    return jsonError("DB error: " + error.message, 500);
  }

  console.log("[9] insert OK, id:", data.id);
  const report = stripSession(data as Report);
  console.log("=== POST /api/reports SUCCESS ===");
  return Response.json({ id: report.id, report }, { status: 201 });
}