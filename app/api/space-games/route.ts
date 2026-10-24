export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

const MAX_STATE_CHARS = 60_000;

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
    const { action, gameId, communityId, dmThreadId, game_state, players } = body ?? {};
    const db = createServiceClient();

    const validState = (s: unknown) =>
      !!s && typeof s === "object" && JSON.stringify(s).length <= MAX_STATE_CHARS;

    async function canAccess(cId?: string, dmId?: string): Promise<boolean> {
      if (cId && typeof cId === "string") {
        const { data: c } = await db.from("communities").select("is_public").eq("id", cId).maybeSingle();
        if (!c) return false;
        if (c.is_public) return true;
        const { data: m } = await db.from("community_members").select("id").eq("community_id", cId).eq("session_id", sid).maybeSingle();
        return !!m;
      }
      if (dmId && typeof dmId === "string") {
        const { data: t } = await db.from("dm_threads").select("session_a, session_b").eq("id", dmId).maybeSingle();
        return !!t && (t.session_a === sid || t.session_b === sid);
      }
      return false;
    }

    const col = dmThreadId ? "dm_thread_id" : "community_id";
    const val = dmThreadId || communityId;

    if (action === "get") {
      if (!(await canAccess(communityId, dmThreadId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { data } = await db.from("space_games").select("*").eq(col, val)
        .in("status", ["waiting", "playing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return NextResponse.json({ game: data ?? null });
    }

    if (action === "start") {
      if (!(await canAccess(communityId, dmThreadId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (!validState(game_state)) return NextResponse.json({ error: "bad state" }, { status: 400 });
      const withBot = Array.isArray(players) && players.includes("bot");
      await db.from("space_games").delete().eq(col, val).eq("status", "finished");
      const { data, error } = await db.from("space_games").insert({
        [col]: val,
        game_type: "whot",
        created_by: sid,
        players: withBot ? [sid, "bot"] : [sid],
        status: withBot ? "playing" : "waiting",
        game_state
      }).select().single();
      if (error) { console.error("[space-games start]", error.message); return NextResponse.json({ error: "Could not start game" }, { status: 500 }); }
      return NextResponse.json({ game: data });
    }

    if (!gameId || typeof gameId !== "string") return NextResponse.json({ error: "gameId required" }, { status: 400 });
    const { data: game } = await db.from("space_games")
      .select("id, community_id, dm_thread_id, players, status, created_by").eq("id", gameId).maybeSingle();
    if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canAccess(game.community_id ?? undefined, game.dm_thread_id ?? undefined))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const current: string[] = Array.isArray(game.players) ? game.players : [];

    if (action === "join") {
      const max = game.dm_thread_id ? 2 : 4;
      if (game.status !== "waiting" || current.includes(sid) || current.length >= max) {
        return NextResponse.json({ error: "Cannot join this game" }, { status: 409 });
      }
      if (!validState(game_state)) return NextResponse.json({ error: "bad state" }, { status: 400 });
      const newPlayers = [...current, sid];
      const { error } = await db.from("space_games").update({
        players: newPlayers, game_state, status: newPlayers.length >= 2 ? "playing" : "waiting"
      }).eq("id", gameId);
      if (error) return NextResponse.json({ error: "Could not join" }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "update_state") {
      if (!current.includes(sid)) return NextResponse.json({ error: "Not a player" }, { status: 403 });
      if (!validState(game_state)) return NextResponse.json({ error: "bad state" }, { status: 400 });
      const { error } = await db.from("space_games").update({ game_state }).eq("id", gameId);
      if (error) return NextResponse.json({ error: "Could not save move" }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (!current.includes(sid) && game.created_by !== sid) return NextResponse.json({ error: "Not a player" }, { status: 403 });
      const { error } = await db.from("space_games").delete().eq("id", gameId);
      if (error) return NextResponse.json({ error: "Could not end game" }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[space-games]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
