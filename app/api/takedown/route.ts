export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  let body: {
    postUrl?: string;
    name?: string;
    contact?: string;
    explanation?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const postUrl = String(body.postUrl ?? "").trim();
  const name = String(body.name ?? "").trim();
  const contact = String(body.contact ?? "").trim();
  const explanation = String(body.explanation ?? "").trim();

  if (!postUrl || !name || !contact || explanation.length < 30) {
    return Response.json({ error: "Please fill all fields." }, { status: 400 });
  }

  const match = postUrl.match(/\/r\/([A-Za-z0-9_-]+)/);
  if (!match) {
    return Response.json(
      { error: "Post link looks wrong. Copy it from the report page." },
      { status: 400 }
    );
  }
  const reportId = match[1];

  const db = createServiceClient();

  const { data: report } = await db
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    return Response.json({ error: "That report does not exist." }, { status: 404 });
  }

  const sessionId = await getSessionId();

  const { error } = await db.from("disputes").insert({
    id: nanoid(),
    report_id: reportId,
    claimant_name: name,
    claimant_contact: contact,
    explanation,
    resolved: false
  });

  if (error) {
    console.error("dispute insert:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }

  await db
    .from("reports")
    .update({ status: "disputed" })
    .eq("id", reportId);

  await db.from("moderation_actions").insert({
    report_id: reportId,
    action: "dispute_filed",
    moderator_note: `Claimant: ${name}. Session: ${sessionId ?? "none"}`
  });

  return Response.json({ ok: true });
}