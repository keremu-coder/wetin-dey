export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { CATEGORIES, NIGERIA_STATES, PAGE_SIZE } from "@/lib/constants";
import { stripExifServer } from "@/lib/exif";
import { originAllowed, jsonError } from "@/lib/http";
import { hashDedupe } from "@/lib/rateLimit";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";
import { scoreDefamation } from "@/lib/defamation";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "@/lib/terms-guard";

const ALLOWED_TYPES = [
  "talk_am",
  "report_am",
  "ask",
  "news",
  "help",
  "rant",
  "talent"
];

const TALK_AM_TYPES = ["report_am", "ask", "help"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const state = searchParams.get("state");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const agency = searchParams.get("agency");
  const status = searchParams.get("status");
  const tab = searchParams.get("tab") ?? "talk";

  const db = createServiceClient();
  let q = db
    .from("reports")
    .select(
      "id, created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo, evidence_url, evidence_type, evidence_link, evidence_label, summary_pidgin, summary_english, incident_date, status, reviewed, reviewer_note, formalization_confidence, dedupe_hash, author_handle, post_type, upvotes, downvotes, me_too_count, comment_count, evidence_tier, target_type, community_id"
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (tab === "talk") {
    q = q
      .in("post_type", TALK_AM_TYPES)
      .eq("reviewed", true)
      .eq("held", false)
      .is("community_id", null);
  } else {
    q = q
      .in("post_type", ["talk_am", "news", "talent", "rant"])
      .is("community_id", null);
  }

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
  const originOk = originAllowed(req);
  if (!originOk) return jsonError("origin blocked", 403);

  let sessionId: string | null = null;
  try {
    sessionId = await getSessionId();
  } catch {
    return jsonError("session error", 500);
  }
  if (!sessionId) return jsonError("no session", 401);

  if (await isBanned(sessionId)) {
    return jsonError(BANNED_MESSAGE, 403);
  }

  if (!(await hasAcceptedTerms(sessionId))) {
    return Response.json(
      { error: TERMS_NOT_ACCEPTED_MESSAGE, code: TERMS_NOT_ACCEPTED_CODE },
      { status: 403 }
    );
  }

  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) return jsonError("profile failed", 500);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("form parse error", 400);
  }

  const postType = String(form.get("post_type") ?? "report_am");
  const communitySlug = String(form.get("community_slug") ?? "").trim() || null;
  const category = String(form.get("category") ?? "other");
  const agency_raw = String(form.get("agency") ?? "").trim() || "Community post";
  const state = String(form.get("state") ?? "");
  const lga = String(form.get("lga") ?? "").trim() || null;
  const body = String(form.get("body") ?? "").trim();
  const amountRaw = String(form.get("amount") ?? "").trim();
  const targetTypeRaw = String(form.get("target_type") ?? "public").trim();
  const targetType: "public" | "private" =
    targetTypeRaw === "private" ? "private" : "public";

  if (!ALLOWED_TYPES.includes(postType)) {
    return jsonError("post type no correct", 400);
  }

  const isTalkReport = postType === "report_am";
  const requiresEvidence = isTalkReport;

  const file = form.get("evidence");
  const publicLink = String(form.get("public_link") ?? "").trim();
  const voiceTestimony = form.get("voice_testimony");

  let evidenceType: string | null = null;
  let evidenceUrl: string | null = null;
  let evidenceLink: string | null = null;
  let evidenceLabel = "";

  if (file instanceof File && file.size > 0) {
    const mime = file.type || "";
    if (mime.startsWith("image/")) evidenceType = "photo";
    else if (mime.startsWith("video/")) evidenceType = "video";
    else if (mime.startsWith("audio/")) evidenceType = "audio";
    else return jsonError("File must be image, video, or audio.", 400);
  } else if (voiceTestimony instanceof File && voiceTestimony.size > 0) {
    evidenceType = "voice_testimony";
  } else if (publicLink) {
    if (!/^https?:\/\/.+\..+/.test(publicLink)) {
      return jsonError("Public link no correct.", 400);
    }
    evidenceType = "public_link";
    evidenceLink = publicLink;
  }

  if (requiresEvidence && !evidenceType) {
    return jsonError(
      "Report no go publish without evidence. Attach photo, video, audio, voice testimony, or public link.",
      400
    );
  }

  if (evidenceType === "photo" || evidenceType === "video") {
    evidenceLabel = "Report with attached evidence";
  } else if (evidenceType === "audio") {
    evidenceLabel = "Report with recorded evidence";
  } else if (evidenceType === "voice_testimony") {
    evidenceLabel = "First-person testimony — no recorded evidence";
  } else if (evidenceType === "public_link") {
    evidenceLabel = "Backed by public source";
  }

  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return jsonError("category no correct", 400);
  }
  if (!NIGERIA_STATES.includes(state as (typeof NIGERIA_STATES)[number])) {
    return jsonError("state no correct", 400);
  }
  if (body.length < 50 || body.length > 5000) {
    return jsonError("post must be 50–5000 characters", 400);
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

  let communityId: string | null = null;
  if (communitySlug) {
    const { data: c } = await db
      .from("communities")
      .select("id")
      .eq("slug", communitySlug)
      .maybeSingle();

    if (!c) {
      return jsonError("That space does not exist.", 400);
    }

    const { data: membership } = await db
      .from("community_members")
      .select("id")
      .eq("community_id", c.id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!membership) {
      return jsonError("You need to join that space first.", 403);
    }

    communityId = c.id;
  }

  const { scoreEvidence } = await import("@/lib/verification");

  const { count: sessionPostCount } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const verification = scoreEvidence({
    evidenceType,
    evidenceLink,
    body,
    agencyRaw: agency_raw,
    sessionPostCount: sessionPostCount ?? 0
  });

  const defamation = scoreDefamation({
    body,
    agency_raw,
    agency_canonical: agency_raw,
    amount_kobo,
    evidence_url: evidenceUrl,
    public_link: evidenceLink
  });

  const held =
    targetType === "private" ||
    verification.requiresManualReview ||
    defamation.held;

  if (file instanceof File && file.size > 0) {
    try {
      if (file.size > 25 * 1024 * 1024) {
        return jsonError("File too large (max 25MB)", 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      let uploadBuf: Buffer = buf;
      let ext = "bin";
      let contentType = file.type || "application/octet-stream";

      if (file.type.startsWith("image/")) {
        uploadBuf = await stripExifServer(buf);
        ext = "jpg";
        contentType = "image/jpeg";
      } else if (file.type.startsWith("video/")) {
        ext = "mp4";
      } else if (file.type.startsWith("audio/")) {
        ext = "webm";
      }

      const path = `${id}.${ext}`;
      const up = await db.storage.from("evidence").upload(path, uploadBuf, {
        contentType,
        upsert: false
      });
      if (up.error) {
        return jsonError("Upload failed: " + up.error.message, 500);
      }
      evidenceUrl = db.storage.from("evidence").getPublicUrl(path).data
        .publicUrl;
    } catch (e) {
      return jsonError("Upload error: " + (e as Error).message, 500);
    }
  } else if (voiceTestimony instanceof File && voiceTestimony.size > 0) {
    try {
      if (voiceTestimony.size > 10 * 1024 * 1024) {
        return jsonError("Voice too large", 400);
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
      evidenceUrl = db.storage.from("evidence").getPublicUrl(path).data
        .publicUrl;
    } catch (e) {
      return jsonError("Voice error: " + (e as Error).message, 500);
    }
  }

  const dedupe_hash = hashDedupe({
    category,
    agency_canonical: agency_raw,
    state,
    lga
  });

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
    post_type: postType,
    requires_evidence: requiresEvidence,
    is_per_post_anonymous: false,
    dedupe_hash,
    evidence_tier: verification.tier,
    source_domain: verification.sourceDomain,
    target_type: targetType,
    held,
    defamation_risk: defamation.risk,
    defamation_reasons: defamation.reasons,
    requires_manual_review: held,
    community_id: communityId
  };

  const { data, error } = await db
    .from("reports")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    if (String(error.message).toLowerCase().includes("rate limit")) {
      return jsonError("slow down — too many posts this hour", 429);
    }
    console.error("INSERT FAILED:", error);
    return jsonError("DB error: " + error.message, 500);
  }

  if (postType === "report_am") {
    try {
      const { formalizeReport } = await import("@/lib/formalize");
      void formalizeReport({
        category,
        agency_raw,
        state,
        body,
        amount_kobo
      })
        .then(async (output) => {
          if (output && output.confidence >= 0.5) {
            const aiRisk =
              typeof output.defamation_risk === "number"
                ? output.defamation_risk
                : 0;
            const combinedRisk = Math.max(defamation.risk, aiRisk);
            const combinedReasons = Array.from(
              new Set([
                ...defamation.reasons,
                ...(Array.isArray(output.defamation_reasons)
                  ? output.defamation_reasons
                  : [])
              ])
            );
            const heldByAi = combinedRisk >= 0.6;

            const stillHeld = held || heldByAi;

            await db
              .from("reports")
              .update({
                summary_pidgin: output.summary_pidgin,
                summary_english: output.summary_english,
                agency_canonical: output.agency_canonical,
                incident_date: output.incident_date,
                formalization_confidence: output.confidence,
                reviewed: !stillHeld && output.confidence >= 0.7,
                defamation_risk: combinedRisk,
                defamation_reasons: combinedReasons,
                held: stillHeld
              })
              .eq("id", id);
          }
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
  }

  const report = stripSession(data as Report);
  return Response.json({ id: report.id, report, held }, { status: 201 });
}