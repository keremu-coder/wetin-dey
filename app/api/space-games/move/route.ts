export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { canAccessSpace } from "@/lib/space-access";
import { applyMove } from "@/lib/whot-engine";
import type { WhotState } from "@/lib/whot";
import { serverError } from "@/lib/http";

/**
 * The only way to change a Whot game. The client sends an intent
 * (play / pick / reset / bot_move); the server checks it against the real
 * state and writes the result. Clients never send state.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

    const limit = await checkRateLimit(sid, { key: "whot_move", limit: 120, windowMs: 60 * 1000 }, { ip: getRequestIp(req) });
    if (!limit.ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
    const gameId = body?.game_id;
    if (!gameId || typeof gameId !== "string") return NextResponse.json({ error: "game_id required" }, { status: 400 });

    const db = createServiceClient();
    const { data: game } = await db.from("space_games")
      .select("id, community_id, dm_thread_id, players, game_state")
      .eq("id", gameId).maybeSingle();
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (!(await canAccessSpace(db, sid, game.community_id ?? undefined, game.dm_thread_id ?? undefined))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const players: string[] = Array.isArray(game.players) ? game.players : [];
    if (!players.includes(sid)) return NextResponse.json({ error: "Not a player" }, { status: 403 });

    let state = game.game_state as WhotState;
    if (!state || typeof state !== "object" || !state.hands || !Array.isArray(state.deck) || !Array.isArray(state.discard)) {
      return NextResponse.json({ error: "Game state is invalid. Start a new game." }, { status: 409 });
    }
    if (typeof state.rev !== "number") {
      const initializedState = { ...state, rev: 0, lastCardCalledBy: null };
      const { data: claimed, error: claimError } = await db.from("space_games")
        .update({ game_state: initializedState })
        .eq("id", gameId)
        .eq("game_state->>turn", state.turn)
        .is("game_state->>rev", null)
        .select("id");

      if (claimError) return NextResponse.json({ error: "Could not initialize game revision" }, { status: 500 });
      if (!claimed || claimed.length === 0) return NextResponse.json({ error: "Game changed. Try again." }, { status: 409 });
      state = initializedState;
    }

    const humans = players.filter((p) => p !== "bot");
    let handles: Record<string, string> = {};
    if (humans.length > 0) {
      const { data: rows } = await db.from("sessions").select("id, handle").in("id", humans);
      for (const r of rows ?? []) if (r.handle) handles[r.id] = r.handle;
    }
    const nameOf = (id: string): string =>
      id === "bot" ? "🤖 Bot" : handles[id] ? "@" + handles[id] : "Player " + (players.indexOf(id) + 1);

    const result = applyMove(
      state,
      players,
      sid,
      { action: body.action, cardId: body.card_id, calledSuit: body.called_suit, declaredLastCard: body.has_declared_last_card },
      nameOf
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    // Optimistic lock: only write if nobody else moved since we read the state.
    let q = db.from("space_games").update({ game_state: result.next })
      .eq("id", gameId)
      .eq("game_state->>turn", state.turn)
      .eq("game_state->>rev", String(state.rev));
    const { data: updated, error } = await q.select("id");
    if (error) return NextResponse.json({ error: "Could not save move" }, { status: 500 });
    if (!updated || updated.length === 0) return NextResponse.json({ error: "Game changed. Try again." }, { status: 409 });

    return NextResponse.json({ ok: true, text: result.text, penalty: result.penalty === true });
  } catch (e) {
    return serverError("space-games/move", e);
  }
}
