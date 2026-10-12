export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

// GET  — my inbox (unacknowledged signals sent to me) + my contacts
// POST — add a contact by handle (I can signal them)
// DELETE — remove a contact

export async function GET() {
  try {
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const db = createServiceClient();

    const [inboxRes, contactsRes] = await Promise.all([
      db.from("radar_signals")
        .select("id, sender_id, signal_type, note, lat, lng, location_sharing, location_stopped, acknowledged_at, created_at")
        .eq("recipient_id", sid)
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("radar_contacts")
        .select("contact_id, created_at")
        .eq("owner_id", sid)
        .order("created_at", { ascending: false })
        .limit(200)
    ]);

    const signals = inboxRes.data ?? [];
    const contactIds = (contactsRes.data ?? []).map((r) => r.contact_id as string);
    const senderIds = Array.from(new Set(signals.map((s) => s.sender_id as string).concat(contactIds)));

    const sessionsRes = senderIds.length > 0
      ? await db.from("sessions").select("id, handle, display_name, avatar_url").in("id", senderIds)
      : { data: [] as Array<{ id: string; handle: string; display_name: string | null; avatar_url: string | null }> };

    const people = new Map<string, { handle: string; display_name: string | null; avatar_url: string | null }>();
    for (const s of (sessionsRes.data ?? []) as Array<{ id: string; handle: string; display_name: string | null; avatar_url: string | null }>) {
      people.set(s.id, { handle: s.handle, display_name: s.display_name, avatar_url: s.avatar_url });
    }

    return NextResponse.json({
      inbox: signals.map((s) => ({ ...s, sender: people.get(s.sender_id as string) ?? null })),
      contacts: contactIds.map((id) => ({ id, ...(people.get(id) ?? { handle: null, display_name: null, avatar_url: null }) }))
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const body = (await req.json()) as { handle?: unknown };
    const handle = typeof body?.handle === "string" ? body.handle.replace(/^@/, "").trim().toLowerCase() : "";
    if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

    const db = createServiceClient();
    const { data: target } = await db.from("sessions").select("id").eq("handle_lower", handle).maybeSingle();
    if (!target?.id) return NextResponse.json({ error: "no such person" }, { status: 404 });
    if (target.id === sid) return NextResponse.json({ error: "that's you" }, { status: 400 });

    const { error } = await db.from("radar_contacts").upsert(
      { owner_id: sid, contact_id: target.id },
      { onConflict: "owner_id,contact_id", ignoreDuplicates: true }
    );
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });
    const body = (await req.json()) as { contactId?: unknown };
    const cid = typeof body?.contactId === "string" ? body.contactId : null;
    if (!cid) return NextResponse.json({ error: "contactId required" }, { status: 400 });
    const db = createServiceClient();
    const { error } = await db.from("radar_contacts").delete().eq("owner_id", sid).eq("contact_id", cid);
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}