/**
 * Image moderation.
 *
 * Currently a HOLD-FOR-REVIEW stub, not an AI classifier. Reason: our
 * Groq plan does not expose a vision-capable model, so any call to a
 * vision endpoint would fail and silently fail-open, giving us no real
 * coverage. Instead, every image report is held for human review before
 * it can publish — which is what our Community Guidelines already
 * promise (24h review for media).
 *
 * When a vision model becomes available, replace the body of
 * classifyImage() with the AI call and keep the return shape identical.
 * All call sites depend only on { hold, matches, reasons }.
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

export async function classifyImage(
  _buffer: Buffer
): Promise<ImageModerationResult> {
  return {
    hold: true,
    matches: [{ kind: "other" as FilterMatch["kind"], text: "image", index: 0 }],
    reasons: [
      "Image reports are reviewed by a moderator before publishing. " +
        "This is a normal step for evidence uploads."
    ]
  };
}