export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const sid = await getSessionId();
  if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { action, gameId, communityId, dmThreadId, game_state, players, status } = body;
  const db = createServiceClient();

  async function canAccess(cId?: string, dmId?: string) {
    if (cId) {
      const { data: c } = await db.from("communities").select("is_public").eq("id", cId).maybeSingle();
      if (!c) return false;
      if (c.is_public) return true;
      const { data: m } = await db.from("community_members").select("id").eq("community_id", cId).eq("session_id", sid).maybeSingle();
      return !!m;
    }
    if (dmId) {
      const { data: t } = await db.from("dm_threads").select("session_a, session_b").eq("id", dmId).maybeSingle();
      return t && (t.session_a === sid || t.session_b === sid);
    }
    return false;
  }

  if (action === "start") {
    if (!(await canAccess(communityId, dmThreadId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const col = dmThreadId ? "dm_thread_id" : "community_id";
    const val = dmThreadId || communityId;
    await db.from("space_games").delete().eq(col, val).eq("status", "finished");
    const { data, error } = await db.from("space_games").insert({
      [col]: val,
      game_type: "whot",
      created_by: sid,
      players: players,
      status: status,
      game_state: game_state
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: data });
  }

  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });
  const { data: game } = await db.from("space_games").select("community_id, dm_thread_id").eq("id", gameId).maybeSingle();
  if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canAccess(game.community_id, game.dm_thread_id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (action === "join") {
    const { error } = await db.from("space_games").update({ players, game_state, status }).eq("id", gameId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update_state") {
    const { error } = await db.from("space_games").update({ game_state }).eq("id", gameId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const { error } = await db.from("space_games").delete().eq("id", gameId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
