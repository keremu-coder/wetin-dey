"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, AudioConference, useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import { getBrowserClient } from "@/lib/supabase/client";
import { WhotGame } from "./WhotGame";
import { startWhotGame } from "@/lib/whot";

function AudioStatus() {
  const connectionState = useConnectionState();
  if (connectionState === ConnectionState.Connected) return null;
  return (
    <div className="flex h-full items-center justify-center text-white/70 text-sm">
      {connectionState === ConnectionState.Connecting ? "Connecting to live audio..." : "Audio disconnected (Check Vercel Keys)"}
    </div>
  );
}

export function VoiceRoom({
  roomName,
  spaceName,
  communityId,
  currentSessionId,
  onClose,
}: {
  roomName: string;
  spaceName: string;
  communityId: string;
  currentSessionId: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeGame, setActiveGame] = useState<any>(null);
  const [useAnyplay, setUseAnyplay] = useState(true);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  useEffect(() => {
    if (!livekitUrl) {
      setError("Missing NEXT_PUBLIC_LIVEKIT_URL in Vercel settings");
      return;
    }

    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room_name: roomName }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to get token");
        if (!json.token) throw new Error("No token returned");
        setToken(json.token);
      })
      .catch((e) => setError(e.message));
  }, [roomName, livekitUrl]);

  useEffect(() => {
    const supabase = getBrowserClient();
    
    supabase
      .from("space_games")
      .select("*")
      .eq("community_id", communityId)
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setActiveGame(data); });

    const channel = supabase
      .channel(`space_games:${communityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "space_games", filter: `community_id=eq.${communityId}` }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const game = payload.new;
          if (game.status === "finished") setActiveGame(null);
          else setActiveGame(game);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [communityId]);

  async function startGame() {
    const supabase = getBrowserClient();
    const initialState = startWhotGame([currentSessionId], useAnyplay);
    
    const { error } = await supabase.from("space_games").insert({
      community_id: communityId,
      game_type: "whot",
      created_by: currentSessionId,
      players: [currentSessionId],
      status: "waiting",
      game_state: initialState
    });

    if (error) {
      alert("Could not start game. Did you run the SQL for space_games?\n\n" + error.message);
    }
  }

  async function joinGame() {
    if (activeGame.players.length >= 4) return;
    if (activeGame.players.includes(currentSessionId)) return;
    if (activeGame.status !== "waiting") return;

    const newPlayers = [...activeGame.players, currentSessionId];
    const newState = startWhotGame(newPlayers, activeGame.game_state.useAnyplay);
    const newStatus = newPlayers.length >= 2 ? "playing" : "waiting";

    const supabase = getBrowserClient();
    await supabase
      .from("space_games")
      .update({ players: newPlayers, game_state: newState, status: newStatus })
      .eq("id", activeGame.id);
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6 text-white text-center">
        <div>
          <p className="mb-4 text-red-400">{error}</p>
          <button onClick={onClose} className="bg-white/20 px-4 py-2 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 text-white">
        <p>Connecting to voice...</p>
      </div>
    );
  }

  const isPlayer = activeGame?.players?.includes(currentSessionId);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0B0E17]">
      {/* FIX: Added safe-area padding, truncated text, and flex-shrink-0 */}
      <header 
        className="flex items-center justify-between border-b border-white/10 px-4 pb-3 shrink-0"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      >
        <div className="min-w-0 pr-4">
          <h2 className="font-serif text-[1.1rem] font-semibold text-white truncate">{spaceName} Voice</h2>
          <p className="text-[0.75rem] text-white/50">Live Game Room</p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-full bg-red-500/20 px-4 py-2 text-[0.8125rem] font-semibold text-red-400">Leave</button>
      </header>

      {/* Audio Area with minimum height and explicit background */}
      <div className="border-b border-white/10 bg-black p-2 h-24 shrink-0 overflow-y-auto">
        <LiveKitRoom 
          video={false} 
          audio={true} 
          token={token} 
          serverUrl={livekitUrl} 
          onDisconnected={onClose} 
          data-lk-theme="default" 
          style={{ height: '100%' }}
        >
          <AudioConference />
          <AudioStatus />
        </LiveKitRoom>
      </div>

      <div className="flex-1 flex flex-col p-4 overflow-y-auto relative">
        {!activeGame ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-white/50 mb-4 text-center">No game running right now.</p>
            <label className="flex items-center gap-2 mb-6 bg-white/5 px-4 py-3 rounded-xl border border-white/10">
              <input type="checkbox" checked={useAnyplay} onChange={(e) => setUseAnyplay(e.target.checked)} className="w-5 h-5 accent-brand" />
              <span className="text-sm font-medium text-white">Include Whot 20 (Anyplay)</span>
            </label>
            <button onClick={startGame} className="rounded-xl bg-brand px-8 py-4 font-semibold text-white shadow-lg active:scale-95 transition-transform">Start Whot Game</button>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col items-center">
            {activeGame.status === "waiting" && (
              <div className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-6">
                <h3 className="text-white font-bold text-xl mb-2">Waiting for players...</h3>
                <p className="text-white/70 mb-6">{activeGame.players.length} / 4 joined</p>
                <button onClick={joinGame} className="rounded-xl bg-brand px-8 py-3 font-semibold text-white mb-4 shadow-lg">Join Game</button>
                <button onClick={async () => {
                  const supabase = getBrowserClient();
                  await supabase.from("space_games").update({ status: "finished" }).eq("id", activeGame.id);
                }} className="text-white/40 text-sm">Cancel Game</button>
              </div>
            )}
            
            <div className="w-full flex-1 relative min-h-[400px]">
              <WhotGame game={activeGame} isPlayer={isPlayer} sessionId={currentSessionId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}