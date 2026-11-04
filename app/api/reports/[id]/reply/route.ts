export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, sameOrigin, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import { serverError } from "@/lib/http";

const MIN_BODY = 50;
const MAX_BODY = 2000;
const MIN_NAME = 2;
const MAX_NAME = 120;
const MAX_CONTACT = 200;

function looksLikeContact(s: string): boolean {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const phone = /^\+?\d{10,15}$/.test(s.replace(/[\s\-()]/g, ""));
  return email || phone;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    // Audit finding 13: session-only limit was bypassable by dropping
    // the cookie. Add IP bucket too.
    const limit = await checkRateLimit(
      sessionId,
      {
        key: "report_reply",
        limit: 3,
        windowMs: 60 * 60 * 1000
      },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json(
        { error: "Too many replies submitted. Try again later." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      name?: unknown;
      contact?: unknown;
      body?: unknown;
    };

    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
    const contact =
      typeof body.contact === "string"
        ? body.contact.trim().slice(0, MAX_CONTACT)
        : "";
    const text =
      typeof body.body === "string" ? body.body.trim().slice(0, MAX_BODY) : "";

    if (name.length < MIN_NAME) {
      return Response.json(
        { error: "Please enter your name." },
        { status: 400 }
      );
    }
    if (!looksLikeContact(contact)) {
      return Response.json(
        { error: "Please enter a valid email or phone number." },
        { status: 400 }
      );
    }
    if (text.length < MIN_BODY) {
      return Response.json(
        { error: `Your response must be at least ${MIN_BODY} characters.` },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    const { data: report } = await db
      .from("reports")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (!report) {
      return Response.json({ error: "Report not found." }, { status: 404 });
    }

    const { data: existing } = await db
      .from("report_replies")
      .select("id")
      .eq("report_id", params.id)
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return Response.json(
        { error: "You already have a reply pending review." },
        { status: 400 }
      );
    }

    const { error } = await db.from("report_replies").insert({
      id: nanoid(),
      report_id: params.id,
      session_id: sessionId,
      submitter_name: name,
      submitter_contact: contact,
      body: text,
      status: "pending"
    });

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      message:
        "Your response has been submitted. A moderator will review it. If approved, it will appear on the report page."
    });
  } catch (e) {
    return serverError("reports/[id]/reply", e);
  }
}