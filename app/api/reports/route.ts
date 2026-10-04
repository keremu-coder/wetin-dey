export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { CATEGORIES, NIGERIA_STATES, PAGE_SIZE } from "@/lib/constants";
import { stripExifServer } from "@/lib/exif";
import { originAllowed, jsonError } from "@/lib/http";
import { allowReport, hashDedupe } from "@/lib/rateLimit";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
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
      "id, created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo, evidence_url, evidence_type, evidence_link, evidence_label, summary_pidgin, summary_english, incident_date, status, reviewed, reviewer_note, formalization_confidence, dedupe_hash, author_handle, post_type"
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

  const originOk = originAllowed(req);
  if (!originOk) return jsonError("origin blocked", 403);

  let sessionId: string | null = null;
  try {
    sessionId = await getSessionId();
  } catch (e) {
    return jsonError("session error: " + (e as Error).message, 500);
  }
  if (!sessionId) return jsonError("no session", 401);

  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) return jsonError("profile failed", 500);

  if (!allowReport(sessionId)) {
    return jsonError("slow down — too many posts this hour", 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return jsonError("form parse error", 400);
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

  // ─── EVIDENCE ─────────────────────────────────────────
  const file = form.get("evidence");
  const publicLink = String(form.get("public_link") ?? "").trim();
  const voiceTestimony = form.get("voice_testimony"); // audio of reporter speaking

  let evidenceType: string | null = null;
  let evidenceUrl: string | null = null;
  let evidenceLink: string | null = null;
  let evidenceLabel = "";

  // Priority: file upload > voice testimony > public link

  if (file instanceof File && file.size > 0) {
    // Detect type from file MIME
    const mime = file.type || "";
    if (mime.startsWith("image/")) evidenceType = "photo";
    else if (mime.startsWith("video/")) evidenceType = "video";
    else if (mime.startsWith("audio/")) evidenceType = "audio";
    else return jsonError("Evidence must be photo, video, or audio.", 400);
  } else if (voiceTestimony instanceof File && voiceTestimony.size > 0) {
    evidenceType = "voice_testimony";
  } else if (publicLink) {
    if (!/^https?:\/\/.+\..+/.test(publicLink)) {
      return jsonError("Public link no correct.", 400);
    }
    evidenceType = "public_link";
    evidenceLink = publicLink;
  }

  // HARD RULE — evidence is required
  if (!evidenceType) {
    return jsonError(
      "Report no go publish without evidence. Attach photo, video, audio, voice testimony, or public link.",
      400
    );
  }

  // Set the label
  if (evidenceType === "photo") evidenceLabel = "Report with attached evidence";
  else if (evidenceType === "video") evidenceLabel = "Report with attached evidence";
  else if (evidenceType === "audio") evidenceLabel = "Report with recorded evidence";
  else if (evidenceType === "voice_testimony") evidenceLabel = "First-person testimony — no recorded evidence";
  else if (evidenceType === "public_link") evidenceLabel = "Backed by public source";

  // Validate the rest
  if (!anonymous) {
    return jsonError("you must confirm say you dey post anonymous", 400);
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return jsonError("category no correct", 400);
  }
  if (!NIGERIA_STATES.includes(state as (typeof NIGERIA_STATES)[number])) {
    return jsonError("state no correct", 400);
  }
  if (agency_raw.length < 2 || agency_raw.length > 200) {
    return jsonError("agency name no correct", 400);
  }
  if (body.length < 50 || body.length > 5000) {
    return jsonError("story must be 50–5000 characters", 400);
  }

  let amount_kobo: number | null = null;
  if (amountRaw) {
    const naira = Number(amountRaw);
    if (!Number.isFinite(naira) || naira < 0) {
      return jsonError("amount no correct", 400);
    }
    amount_kobo = Math.round(naira * 100);
  }

  const db = createServiceClient();
  const id = nanoid();

  // Upload evidence file
  if (file instanceof File && file.size > 0) {
    try {
      if (file.size > 25 * 1024 * 1024) {
        return jsonError("File too large (max 25MB)", 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());

      let uploadBuf: Buffer = buf;
      let uploadExt = "bin";
      let contentType = file.type || "application/octet-stream";

      if (file.type.startsWith("image/")) {
        uploadBuf = await stripExifServer(buf);
        uploadExt = "jpg";
        contentType = "image/jpeg";
      } else if (file.type.startsWith("video/")) {
        uploadExt = "mp4";
      } else if (file.type.startsWith("audio/")) {
        uploadExt = "webm";
      }

      const path = `${id}.${uploadExt}`;
      const up = await db.storage.from("evidence").upload(path, uploadBuf, {
        contentType,
        upsert: false
      });
      if (up.error) {
        return jsonError("Evidence upload failed: " + up.error.message, 500);
      }
      const pub = db.storage.from("evidence").getPublicUrl(path);
      evidenceUrl = pub.data.publicUrl;
    } catch (e) {
      return jsonError("Evidence error: " + (e as Error).message, 500);
    }
  } else if (voiceTestimony instanceof File && voiceTestimony.size > 0) {
    try {
      if (voiceTestimony.size > 10 * 1024 * 1024) {
        return jsonError("Voice testimony too large (max 10MB)", 400);
      }
      const buf = Buffer.from(await voiceTestimony.arrayBuffer());
      const path = `${id}-testimony.webm`;
      const up = await db.storage.from("evidence").upload(path, buf, {
        contentType: "audio/webm",
        upsert: false
      });
      if (up.error) {
        return jsonError("Voice upload failed: " + up.error.message, 500);
      }
      const pub = db.storage.from("evidence").getPublicUrl(path);
      evidenceUrl = pub.data.publicUrl;
    } catch (e) {
      return jsonError("Voice testimony error: " + (e as Error).message, 500);
    }
  }

  const row = {
    id,
    category,
    agency_raw,
    agency_canonical: agency_raw,
    state,
    lga,
    body,
    amount_kobo,
    evidence_url: evidenceUrl,
    evidence_type: evidenceType,
    evidence_link: evidenceLink,
    evidence_label: evidenceLabel,
    status: "reported",
    reviewed: false,
    session_id: sessionId,
    author_handle: profile?.handle ?? null,
    post_type: "report_am",
    is_per_post_anonymous: false,
    dedupe_hash: hashDedupe([
      sessionId,
      category,
      agency_raw.toLowerCase(),
      state,
      body.slice(0, 200)
    ])
  };

  const { data, error } = await db.from("reports").insert(row).select("*").single();

  if (error) {
    console.error("=== REPORT INSERT FAILED ===");
    console.error(error);
    return jsonError("DB error: " + error.message, 500);
  }

  const report = stripSession(data as Report);
  return Response.json({ id: report.id, report }, { status: 201 });
}