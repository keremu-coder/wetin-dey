import { ImageResponse } from "@vercel/og";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sessionId = await getSessionId();
  const db = createServiceClient();
  const { data } = await db
    .from("reports")
    .select("id, agency_canonical, agency_raw, state, category, summary_pidgin, reviewed, session_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) {
    return new Response("no dey", { status: 404 });
  }
  const report = data as Pick<
    Report,
    "id" | "agency_canonical" | "agency_raw" | "state" | "category" | "summary_pidgin" | "reviewed" | "session_id"
  >;
  if (!report.reviewed && report.session_id !== sessionId) {
    return new Response("no dey", { status: 404 });
  }

  const agency = report.agency_canonical || report.agency_raw;
  const pidgin = (report.summary_pidgin || "Report don land. Summary still dey come.").slice(0, 220);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f7f5f0",
          color: "#1c1a15",
          padding: 56,
          fontFamily: "Georgia, serif"
        }}
      >
        <div style={{ fontSize: 22, fontFamily: "ui-monospace, monospace", color: "#5a574e" }}>
          {report.id}
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>{agency}</div>
        <div style={{ fontSize: 24, marginTop: 12, color: "#5a574e" }}>
          {report.state} · {report.category}
        </div>
        <div style={{ fontSize: 28, marginTop: 36, lineHeight: 1.35, maxWidth: 1040 }}>{pidgin}</div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#1f7a4d"
          }}
        >
          <span>naija-archive.vercel.app/r/{report.id}</span>
          <span>Not independently verified</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
