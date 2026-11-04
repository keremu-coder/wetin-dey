export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { startWhotGame } from "@/lib/whot";
import { maskStateFor } from "@/lib/whot-engine";
import { canAccessSpace } from "@/lib/space-access";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
    const { action, gameId, communityId, dmThreadId, game_state, players } = body ?? {};
    const db = createServiceClient();

    // Players only ever receive their own cards. Opponents' hands and the market are replaced by placeholders of the same size.
    const mask = <T extends { game_state?: any } | null | undefined>(g: T): T =>
      g && (g as any).game_state ? ({ ...(g as any), game_state: maskStateFor((g as any).game_state, sid) } as T) : g;

    const canAccess = (cId?: string, dmId?: string): Promise<boolean> => canAccessSpace(db, sid, cId, dmId);

    async function handlesFor(list: unknown): Promise<Record<string, string>> {
      const ids = (Array.isArray(list) ? list : []).filter((p) => typeof p === "string" && p !== "bot");
      if (ids.length === 0) return {};
      const { data } = await db.from("sessions").select("id, handle").in("id", ids);
      const map: Record<string, string> = {};
      for (const r of data ?? []) if (r.handle) map[r.id] = r.handle;
      return map;
    }

    const col = dmThreadId ? "dm_thread_id" : "community_id";
    const val = dmThreadId || communityId;

    if (action === "get") {
      if (!(await canAccess(communityId, dmThreadId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { data } = await db.from("space_games").select("*").eq(col, val)
        .in("status", ["waiting", "playing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      
      if (data) {
        const age = Date.now() - new Date(data.created_at).getTime();
        const isStale = data.status === "waiting" ? age > 10 * 60 * 1000 : age > 60 * 60 * 1000;
        if (isStale) {
          await db.from("space_games").delete().eq("id", data.id);
          return NextResponse.json({ game: null, handles: {} });
        }
      }

      return NextResponse.json({ game: mask(data ?? null), handles: data ? await handlesFor(data.players) : {} });
    }

    if (action === "start") {
      if (!(await canAccess(communityId, dmThreadId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const useAnyplay = !(game_state && game_state.useAnyplay === false);
      const { data: live } = await db.from("space_games").select("*").eq(col, val)
        .in("status", ["waiting", "playing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      
      if (live) {
        const age = Date.now() - new Date(live.created_at).getTime();
        const isStale = live.status === "waiting" ? age > 10 * 60 * 1000 : age > 60 * 60 * 1000;
        if (isStale) {
          await db.from("space_games").delete().eq("id", live.id);
        } else {
          return NextResponse.json({ game: mask(live), handles: await handlesFor(live.players) });
        }
      }
      const withBot = Array.isArray(players) && players.includes("bot");
      const seats = withBot ? [sid, "bot"] : [sid];
      await db.from("space_games").delete().eq(col, val).eq("status", "finished");
      const { data, error } = await db.from("space_games").insert({
        [col]: val, game_type: "whot", created_by: sid, players: seats,
        status: withBot ? "playing" : "waiting",
        game_state: startWhotGame(seats, useAnyplay)
      }).select().single();
      if (error) return NextResponse.json({ error: "Could not start game" }, { status: 500 });
      return NextResponse.json({ game: mask(data), handles: await handlesFor(data.players) });
    }

    if (!gameId || typeof gameId !== "string") return NextResponse.json({ error: "gameId required" }, { status: 400 });
    const { data: game } = await db.from("space_games")
      .select("id, community_id, dm_thread_id, players, status, created_by, game_state").eq("id", gameId).maybeSingle();
    if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canAccess(game.community_id ?? undefined, game.dm_thread_id ?? undefined))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const current: string[] = Array.isArray(game.players) ? game.players : [];
    const max = game.dm_thread_id ? 2 : 4;
    const anyplay = !(game.game_state && (game.game_state as any).useAnyplay === false);

    if (action === "join") {
      if (game.status !== "waiting" || current.includes(sid) || current.length >= max) return NextResponse.json({ error: "Cannot join" }, { status: 409 });
      const newPlayers = [...current, sid];
      const full = newPlayers.length >= max;
      const patch: Record<string, unknown> = { players: newPlayers };
      if (full) { patch.status = "playing"; patch.game_state = startWhotGame(newPlayers, anyplay); }
      await db.from("space_games").update(patch).eq("id", gameId).eq("status", "waiting");
      return NextResponse.json({ ok: true });
    }

    if (action === "begin") {
      if (game.created_by !== sid) return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
      if (game.status !== "waiting" || current.length < 2) return NextResponse.json({ error: "Need 2 players" }, { status: 409 });
      await db.from("space_games").update({ status: "playing", game_state: startWhotGame(current, anyplay) }).eq("id", gameId).eq("status", "waiting");
      return NextResponse.json({ ok: true });
    }

    if (action === "leave") {
      if (game.status !== "waiting" || !current.includes(sid)) return NextResponse.json({ ok: true });
      if (game.created_by === sid) { await db.from("space_games").delete().eq("id", gameId); return NextResponse.json({ ok: true }); }
      await db.from("space_games").update({ players: current.filter((p) => p !== sid) }).eq("id", gameId).eq("status", "waiting");
      return NextResponse.json({ ok: true });
    }

    if (action === "update_state") {
      // Clients may no longer write game state. Moves go through /api/space-games/move, which validates them.
      return NextResponse.json({ error: "Use /api/space-games/move" }, { status: 410 });
    }

    if (action === "delete") {
      if (!current.includes(sid) && game.created_by !== sid) return NextResponse.json({ error: "Not a player" }, { status: 403 });
      await db.from("space_games").delete().eq("id", gameId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[space-games]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
