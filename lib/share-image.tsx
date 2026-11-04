import { ImageResponse } from "@vercel/og";

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };
export const SHARE_IMAGE_CONTENT_TYPE = "image/png";

export type ShareImageData = {
  title: string;
  state: string | null;
  lga: string | null;
  category: string | null;
  evidenceTier: string | null;
  summaryPidgin: string | null;
};

function tierLabel(tier: string | null): string {
  if (tier === "strong") return "Strong evidence";
  if (tier === "medium") return "Medium evidence";
  return "Unverified";
}

function tierColor(tier: string | null): string {
  if (tier === "strong") return "#34d399";
  if (tier === "medium") return "#facc15";
  return "#8b8f95";
}

/**
 * Renders the Wetin Dey share card as a 1200x630 PNG.
 *
 * Used by both:
 *   - app/r/[id]/opengraph-image.tsx  (Next.js auto-detects, emits og:image)
 *   - app/api/share/[id]/route.ts     (in-app ShareCard dialog fetches this)
 *
 * Design: dark paper, brand accent dot, report title as the h1, meta line
 * underneath, evidence tier badge on the right, summary (Pidgin) as the
 * lede. Same visual language as the report detail page.
 */
export function buildShareImage(data: ShareImageData): ImageResponse {
  const metaParts = [
    data.state,
    data.lga ? data.lga : null,
    data.category
  ].filter((x): x is string => !!x);

  const summary = (data.summaryPidgin ?? "").trim();
  const trimmedSummary =
    summary.length > 200 ? summary.slice(0, 197) + "..." : summary;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          backgroundColor: "#0a0a0a",
          color: "#e7e9ea",
          fontFamily: "sans-serif"
        }}
      >
        {/* Header row: brand dot + wordmark, evidence tier on the right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "auto"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                backgroundColor: "#10b981"
              }}
            />
            <div
              style={{
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#e7e9ea"
              }}
            >
              Wetin Dey
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 20px",
              borderRadius: "999px",
              border: `1px solid ${tierColor(data.evidenceTier)}40`,
              backgroundColor: `${tierColor(data.evidenceTier)}18`,
              fontSize: "22px",
              fontWeight: 500,
              color: tierColor(data.evidenceTier)
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: tierColor(data.evidenceTier)
              }}
            />
            {tierLabel(data.evidenceTier)}
          </div>
        </div>

        {/* Title block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "48px",
            marginBottom: "32px"
          }}
        >
          <div
            style={{
              fontSize: "64px",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#e7e9ea",
              maxWidth: "1000px"
            }}
          >
            {data.title}
          </div>
          {metaParts.length > 0 ? (
            <div
              style={{
                marginTop: "20px",
                fontSize: "24px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#71767b"
              }}
            >
              {metaParts.join(" · ")}
            </div>
          ) : null}
        </div>

        {/* Summary as the lede */}
        {trimmedSummary ? (
          <div
            style={{
              fontSize: "26px",
              lineHeight: 1.5,
              color: "#8b8f95",
              maxWidth: "1000px",
              marginTop: "auto"
            }}
          >
            {trimmedSummary}
          </div>
        ) : null}
      </div>
    ),
    { ...SHARE_IMAGE_SIZE }
  );
}