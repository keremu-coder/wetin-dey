export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { nanoid } from "nanoid";
import { CATEGORIES, NIGERIA_STATES, PAGE_SIZE } from "@/lib/constants";
import { stripExifServer } from "@/lib/exif";
import { classifyImage } from "@/lib/image-moderation";
import { transcribeAndModerate } from "@/lib/voice-moderation";
import { stripMediaMetadata } from "@/lib/media-strip";
import { audioContainerFor } from "@/lib/audio-container";
import { videoContainerFor } from "@/lib/video-container";
import { validateEvidenceLink } from "@/lib/evidence-link";
import { jsonError, serverError } from "@/lib/http";
import {
  checkRateLimit,
  getRequestIp,
  hashDedupe,
  sameOrigin
} from "@/lib/rate-limit";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";
import { scoreDefamation } from "@/lib/defamation";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import { getBlockedIds } from "@/lib/blocks";
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

const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const MAX_VOICE_BYTES = 10 * 1024 * 1024;

const EVIDENCE_MIMES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg", "audio/wav"
]);

const VOICE_MIMES = new Set([
  "audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg", "audio/wav"
]);

type StagedFile = {
  path: string;
  mime: string;
  size: number;
  buffer: Buffer;
};

// Download and verify a staged upload. Trusts the storage-layer metadata
// (Blob.type / Blob.size), not the client's declared mime/size.
async function downloadStaged(
  db: ReturnType<typeof createServiceClient>,
  sessionId: string,
  rawPath: string,
  kind: "evidence" | "voice_testimony"
): Promise<{ ok: true; file: StagedFile } | { ok: false; error: string }> {
  const expectedPrefix = `${sessionId}/${kind}/`;
  if (!rawPath.startsWith(expectedPrefix)) {
    return { ok: false, error: "Invalid upload path." };
  }
  if (rawPath.length > 200 || rawPath.includes("..")) {
    return { ok: false, error: "Invalid upload path." };
  }
  if (!/^[\w\-./]+$/.test(rawPath)) {
    return { ok: false, error: "Invalid upload path." };
  }

  const { data, error } = await db.storage
    .from("evidence-staging")
    .download(rawPath);

  if (error || !data) {
    return { ok: false, error: "Uploaded file not found. Upload again." };
  }

  // Blob.type and Blob.size come from the storage layer, not the client.
  const actualMime = (data.type || "").toLowerCase();
  const actualSize = data.size;

  const max = kind === "voice_testimony" ? MAX_VOICE_BYTES : MAX_EVIDENCE_BYTES;
  if (actualSize <= 0 || actualSize > max) {
    await db.storage.from("evidence-staging").remove([rawPath]).catch(() => {});
    return { ok: false, error: "File size is not accepted." };
  }

  const allowed = kind === "voice_testimony" ? VOICE_MIMES : EVIDENCE_MIMES;
  if (!actualMime || !allowed.has(actualMime)) {
    await db.storage.from("evidence-staging").remove([rawPath]).catch(() => {});
    return { ok: false, error: "That file type is not accepted." };
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return {
    ok: true,
    file: { path: rawPath, mime: actualMime, size: actualSize, buffer }
  };
}

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

  const sessionId = await getSessionId();
  const blockedIds = await getBlockedIds(sessionId);

  const db = createServiceClient();
  let q = db
    .from("reports")
    .select(
      "id, created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo, evidence_url, evidence_type, evidence_link, evidence_label, summary_pidgin, summary_english, incident_date, status, reviewed, author_handle, post_type, upvotes, downvotes, me_too_count, comment_count, evidence_tier, target_type, community_id, session_id"
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
      .eq("held", false)
      .is("community_id", null);
  }

  if (state) q = q.eq("state", state);
  if (category) q = q.eq("category", category);
  if (agency) q = q.eq("agency_canonical", agency);
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  if (blockedIds.size > 0) {
    q = q.not("session_id", "in", `(${Array.from(blockedIds).join(",")})`);
  }

  const { data, error } = await q;
  if (error) return jsonError("feed no load", 500);

  const sessionIds = Array.from(new Set((data ?? []).map(r => r.session_id).filter(Boolean)));
  const sessionMap = new Map();
  if (sessionIds.length > 0) {
    const { data: profiles } = await db.from("sessions").select("id, avatar_url, photo_visibility").in("id", sessionIds);
    for (const p of profiles ?? []) sessionMap.set(p.id, p);
  }

  const cleaned = (data ?? []).map((r) => {
    const { session_id: _ignored, ...rest } = r as Record<string, unknown> & {
      session_id?: string;
    };
    const prof = _ignored ? sessionMap.get(_ignored) : null;
    return {
      ...rest,
      author_avatar_url: prof?.avatar_url || null,
      author_photo_visibility: prof?.photo_visibility || "private"
    };
  });

  return Response.json({ reports: cleaned });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError("origin blocked", 403);

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

  // Rate limit before touching the body. A flood here would otherwise
  // download 25MB from staging, run sharp, and hit Groq on every attempt.
  const limit = await checkRateLimit(
    sessionId,
    { key: "report_create", limit: 20, windowMs: 60 * 60 * 1000 },
    { ip: getRequestIp(req) }
  );
  if (!limit.ok) {
    return Response.json(
      { error: "slow down — too many reports. try again later." },
      { status: 429 }
    );
  }

  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) return jsonError("profile failed", 500);

  // Fix 1: file payloads no longer travel in the request body — they go
  // via signed uploads to evidence-staging. The main route only accepts
  // JSON. Any legacy multipart call returns 400 and the client updates
  // atomically with this deploy.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return jsonError("Content-Type must be application/json.", 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError("form parse error", 400);
  }

  const postType = String(body.post_type ?? "report_am");
  const communitySlug = String(body.community_slug ?? "").trim() || null;
  const category = String(body.category ?? "other");
  const agency_raw =
    String(body.agency ?? "").trim().slice(0, 200) || "Community post";
  const state = String(body.state ?? "");
  const lga = String(body.lga ?? "").trim().slice(0, 80) || null;
  const bodyText = String(body.body ?? "").trim();
  const amountRaw = String(body.amount ?? "").trim();
  const targetTypeRaw = String(body.target_type ?? "public").trim();
  const targetType: "public" | "private" =
    targetTypeRaw === "private" ? "private" : "public";

  const publicLink = String(body.public_link ?? "").trim();
  const evidencePath = String(body.evidence_path ?? "").trim();
  const voiceTestimonyPath = String(body.voice_testimony_path ?? "").trim();

  if (!ALLOWED_TYPES.includes(postType)) {
    return jsonError("post type no correct", 400);
  }

  const isTalkReport = postType === "report_am";
  const requiresEvidence = isTalkReport;

  if (evidencePath && voiceTestimonyPath) {
    return jsonError(
      "Attach either a file or a voice testimony, not both.",
      400
    );
  }

  let evidenceType: string | null = null;
  let evidenceLink: string | null = null;
  let evidenceLabel = "";

  const db = createServiceClient();
  let evidenceStaged: StagedFile | null = null;
  let voiceStaged: StagedFile | null = null;

  if (evidencePath) {
    const dl = await downloadStaged(db, sessionId, evidencePath, "evidence");
    if (!dl.ok) return jsonError(dl.error, 400);
    evidenceStaged = dl.file;

    if (evidenceStaged.mime.startsWith("image/")) evidenceType = "photo";
    else if (evidenceStaged.mime.startsWith("video/")) evidenceType = "video";
    else if (evidenceStaged.mime.startsWith("audio/")) evidenceType = "audio";
    else return jsonError("File must be image, video, or audio.", 400);
  } else if (voiceTestimonyPath) {
    const dl = await downloadStaged(
      db,
      sessionId,
      voiceTestimonyPath,
      "voice_testimony"
    );
    if (!dl.ok) return jsonError(dl.error, 400);
    voiceStaged = dl.file;
    evidenceType = "voice_testimony";
  } else if (publicLink) {
    const validated = validateEvidenceLink(publicLink);
    if (!validated.ok) return jsonError(validated.error, 400);
    evidenceType = "public_link";
    evidenceLink = validated.url;
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
  if (bodyText.length < 50 || bodyText.length > 5000) {
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

  const id = nanoid();

  let communityId: string | null = null;
  if (communitySlug) {
    const { data: c } = await db
      .from("communities")
      .select("id")
      .eq("slug", communitySlug)
      .maybeSingle();

    if (!c) return jsonError("That space does not exist.", 400);

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
    body: bodyText,
    agencyRaw: agency_raw,
    sessionPostCount: sessionPostCount ?? 0
  });

  const defamation = scoreDefamation({
    body: bodyText,
    agency_raw,
    agency_canonical: agency_raw,
    amount_kobo,
    evidence_url: null,
    public_link: evidenceLink
  });

  let held =
    targetType === "private" ||
    verification.requiresManualReview ||
    defamation.held;

  let evidenceUrl: string | null = null;

  const cleanupStaging = async () => {
    const paths: string[] = [];
    if (evidenceStaged) paths.push(evidenceStaged.path);
    if (voiceStaged) paths.push(voiceStaged.path);
    if (paths.length > 0) {
      await db.storage.from("evidence-staging").remove(paths).catch(() => {});
    }
  };

  try {
    if (evidenceStaged) {
      let uploadBuf: Buffer = evidenceStaged.buffer;
      let ext: string;
      let contentType: string;

      if (evidenceStaged.mime.startsWith("image/")) {
        uploadBuf = await stripExifServer(evidenceStaged.buffer);
        ext = "jpg";
        contentType = "image/jpeg";
        try {
          const imgMod = await classifyImage(uploadBuf);
          if (imgMod.hold) held = true;
        } catch (e) {
          console.warn("[reports] image moderation error:", e);
        }
      } else if (evidenceStaged.mime.startsWith("video/")) {
        // Always hold video for human review (no video classifier).
        // Container must match the real input format: `-c copy` cannot
        // put a QuickTime stream into an MP4 container, so a bare
        // "mp4" argument made every iPhone video upload fail.
        const container = videoContainerFor(evidenceStaged.mime);
        ext = container.ext;
        contentType = container.contentType;
        held = true;
        uploadBuf = await stripMediaMetadata(evidenceStaged.buffer, container.ext);
      } else {
        const container = audioContainerFor(evidenceStaged.mime);
        ext = container.ext;
        contentType = container.contentType;
        uploadBuf = await stripMediaMetadata(
          evidenceStaged.buffer,
          container.ext
        );
      }

      const finalPath = `${id}.${ext}`;
      const up = await db.storage
        .from("evidence")
        .upload(finalPath, uploadBuf, {
          contentType,
          upsert: false
        });
      if (up.error) {
        await cleanupStaging();
        return jsonError("Upload failed", 500);
      }
      evidenceUrl = db.storage
        .from("evidence")
        .getPublicUrl(finalPath).data.publicUrl;
    } else if (voiceStaged) {
      const voiceContainer = audioContainerFor(voiceStaged.mime);
      const buf = await stripMediaMetadata(
        voiceStaged.buffer,
        voiceContainer.ext
      );
      try {
        const voiceMod = await transcribeAndModerate(buf, voiceStaged.mime);
        if (voiceMod.hold) held = true;
      } catch (e) {
        console.warn("[reports] voice moderation error:", e);
      }
      const finalPath = `${id}-testimony.${voiceContainer.ext}`;
      const up = await db.storage
        .from("evidence")
        .upload(finalPath, buf, {
          contentType: voiceContainer.contentType,
          upsert: false
        });
      if (up.error) {
        await cleanupStaging();
        return jsonError("Voice upload failed", 500);
      }
      evidenceUrl = db.storage
        .from("evidence")
        .getPublicUrl(finalPath).data.publicUrl;
    }
  } catch (e) {
    await cleanupStaging();
    console.error("[reports] staging→final move failed:", e);
    return jsonError("Upload error", 500);
  }

  await cleanupStaging();

  if (!evidenceUrl && !evidenceLink) {
    held = true;
    console.warn("[reports] no evidence — holding for review");
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
    body: bodyText,
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
    // If the row failed, the evidence object is orphaned. Best-effort
    // cleanup so we don't leave public files behind.
    if (evidenceUrl) {
      const marker = "/storage/v1/object/public/evidence/";
      const idx = evidenceUrl.indexOf(marker);
      if (idx >= 0) {
        const p = evidenceUrl.slice(idx + marker.length);
        await db.storage.from("evidence").remove([p]).catch(() => {});
      }
    }
    if (String(error.message).toLowerCase().includes("rate limit")) {
      return jsonError("slow down — too many posts this hour", 429);
    }
    return serverError("reports/insert", error);
  }

  if (postType === "report_am") {
    try {
      const { formalizeReport } = await import("@/lib/formalize");
      waitUntil(
        formalizeReport({
          category,
          agency_raw,
          state,
          body: bodyText,
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
          .catch(() => {})
      );
    } catch {
      /* ignore */
    }
  }

  const report = stripSession(data as Report);
  return Response.json({ id: report.id, report, held }, { status: 201 });
}