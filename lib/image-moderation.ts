/**
 * Image moderation via Groq vision.
 *
 * Called AFTER exif strip, BEFORE storage upload in the reports route.
 * Best-effort by design: any error (no key, network, JSON parse, timeout,
 * oversized payload) fails open — the image is allowed and the report is
 * created normally. Blocking a legitimate civic report because the
 * classifier is unreachable is worse than letting a rare bad image
 * through, and matches the fail-open pattern used everywhere else in
 * this app.
 *
 * Returns the same shape as analyzeModeration() from lib/dm-filter so
 * callers can treat image and text moderation uniformly.
 */

import type { FilterMatch } from "@/lib/dm-filter";

export type ImageModerationResult = {
  hold: boolean;
  matches: FilterMatch[];
  reasons: string[];
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — larger is skipped, not failed
const TIMEOUT_MS = 8000;

const SYSTEM_PROMPT =
  "You are a content moderator for a Nigerian civic reporting platform. " +
  "Classify the image as safe or unsafe.\n\n" +
  "SAFE includes: civic evidence (bad roads, damaged infrastructure, " +
  "protests, checkpoint photos, public documents, receipts), ordinary " +
  "people, ordinary scenes, and low-quality or blurry evidence photos.\n\n" +
  "UNSAFE means any of: threats (weapons aimed at people, credible " +
  "violence), sexual (explicit sexual content), minors (child " +
  "endangerment), graphic (severe gore), hate (extremist symbols, " +
  "mass-casualty threats), doxxing (personal info clearly intended to " +
  "harm).\n\n" +
  "Reply with JSON only, no prose: " +
  '{"safe": true, "categories": [], "reason": "one short sentence"}';

const ALLOWED_CATEGORIES = new Set([
  "threats",
  "sexual",
  "minors",
  "graphic",
  "hate",
  "doxxing"
]);

function mapCategoryToKind(cat: string): string {
  if (cat === "threats") return "threat";
  return cat;
}

function reasonFor(cat: string): string {
  switch (cat) {
    case "threats":
      return "Image may depict a threat of violence.";
    case "sexual":
      return "Image may contain sexual content.";
    case "minors":
      return "Image may endanger a minor.";
    case "graphic":
      return "Image may contain graphic violence.";
    case "hate":
      return "Image may contain hate imagery.";
    case "doxxing":
      return "Image may expose private information.";
    default:
      return "Image held for review.";
  }
}

export async function classifyImage(
  buffer: Buffer
): Promise<ImageModerationResult> {
  const empty: ImageModerationResult = {
    hold: false,
    matches: [],
    reasons: []
  };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[image-mod] GROQ_API_KEY not set — skipping");
    return empty;
  }

  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    console.warn(
      `[image-mod] skip: size ${buffer.length} outside 0..${MAX_BYTES}`
    );
    return empty;
  }

  const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const model = process.env.GROQ_VISION_MODEL || DEFAULT_MODEL;
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this image." },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      console.warn(`[image-mod] groq HTTP ${res.status}`);
      return empty;
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) {
      console.warn("[image-mod] empty completion");
      return empty;
    }

    let parsed: {
      safe?: boolean;
      categories?: unknown;
      reason?: unknown;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[image-mod] JSON parse failed");
      return empty;
    }

    if (parsed.safe !== false) {
      // safe true, or field missing → treat as safe
      return empty;
    }

    const cats = Array.isArray(parsed.categories)
      ? parsed.categories.filter(
          (c): c is string =>
            typeof c === "string" && ALLOWED_CATEGORIES.has(c)
        )
      : [];

    if (cats.length === 0) {
      // Model says unsafe but gave no valid category — be conservative
      // about which categories we trust, and let human review decide.
      cats.push("other");
    }

    const matches: FilterMatch[] = cats.map((c) => ({
      kind: mapCategoryToKind(c) as FilterMatch["kind"],
      text: "image",
      index: 0
    }));

    const reasons: string[] =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? [parsed.reason.trim()]
        : cats.map(reasonFor);

    return { hold: true, matches, reasons };
  } catch (e) {
    console.warn(
      "[image-mod] error:",
      e instanceof Error ? e.message : String(e)
    );
    return empty;
  } finally {
    clearTimeout(timer);
  }
}