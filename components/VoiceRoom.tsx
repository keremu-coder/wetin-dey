"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, AudioConference, useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import { getBrowserClient } from "@/lib/supabase/client";
import { WhotGame } from "./WhotGame";
import { startWhotGame } from "@/lib/whot";
import { Alama } from "./Alama";

function AudioStatus() {
  const connectionState = useConnectionState();
  if (connectionState === ConnectionState.Connected) return null;
  return (
    <div className="flex h-full items-center justify-center text-white/50 text-sm animate-pulse">
      {connectionState === ConnectionState.Connecting ? "Connecting to live audio..." : "Audio disconnected"}
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
  const [isStarting, setIsStarting] = useState(false);
  const [livekitError, setLivekitError] = useState(false);
  
  // Avatar state
  const [mySeed, setMySeed] = useState(currentSessionId);
  
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  useEffect(() => {
    // Load custom avatar seed
    const savedSeed = localStorage.getItem("whot_avatar_seed");
    if (savedSeed) setMySeed(savedSeed);
  }, []);

  function shuffleAvatar() {
    const newSeed = Math.random().toString(36).substring(7);
    setMySeed(newSeed);
    localStorage.setItem("whot_avatar_seed", newSeed);
  }

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

  async function startGame(withBot: boolean = false) {
    if (isStarting) return;
    setIsStarting(true);
    const supabase = getBrowserClient();
    
    // Clean up any old finished games for this community
    await supabase.from("space_games").delete().eq("community_id", communityId).eq("status", "finished");

    const initialState = startWhotGame(withBot ? [currentSessionId, "bot"] : [currentSessionId], useAnyplay);
    
    const { data, error } = await supabase.from("space_games").insert({
      community_id: communityId,
      game_type: "whot",
      created_by: currentSessionId,
      players: withBot ? [currentSessionId, "bot"] : [currentSessionId],
      status: withBot ? "playing" : "waiting",
      game_state: initialState
    }).select().single();

    if (error) {
      alert("Could not start game:\n" + error.message);
      setIsStarting(false);
    } else {
      setActiveGame(data);
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

  async function quitGame() {
    const supabase = getBrowserClient();
    await supabase.from("space_games").delete().eq("id", activeGame.id);
    setActiveGame(null);
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
        <p className="animate-pulse">Connecting to voice...</p>
      </div>
    );
  }

  const isPlayer = activeGame?.players?.includes(currentSessionId);
  const isHost = activeGame?.created_by === currentSessionId;

  return (
    <div 
      className="fixed inset-x-0 bottom-0 z-[200] flex flex-col bg-[#0B0E17] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10"
      style={{ height: "70vh" }}
    >
      {/* Drag Handle */}
      <div className="w-full flex justify-center py-2 shrink-0 cursor-pointer" onClick={onClose}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full" />
      </div>

      <header className="flex items-center justify-between px-4 pb-3 shrink-0">
        <div className="min-w-0 pr-4">
          <h2 className="font-serif text-[1.1rem] font-semibold text-white truncate">{spaceName} Voice</h2>
          <p className="text-[0.75rem] text-white/50">Live Game Room</p>
        </div>
        <button onClick={onClose} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <div className="border-b border-white/10 bg-black p-2 h-24 shrink-0 overflow-y-auto">
        {livekitError ? (
          <div className="flex h-full items-center justify-center text-red-400 text-sm font-semibold">
            Audio failed to connect. Check Vercel keys.
          </div>
        ) : (
          <LiveKitRoom 
            video={false} 
            audio={true} 
            token={token} 
            serverUrl={livekitUrl} 
            onDisconnected={() => setLivekitError(true)} 
            onError={() => setLivekitError(true)}
            data-lk-theme="default" 
            style={{ height: '100%' }}
          >
            <AudioConference />
            <AudioStatus />
          </LiveKitRoom>
        )}
      </div>

      <div className="flex-1 flex flex-col p-4 overflow-y-auto relative">
        {!activeGame ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            
            <div className="flex flex-col items-center mb-6">
              <div className="mb-2 relative cursor-pointer group" onClick={shuffleAvatar}>
                <Alama seed={mySeed} size={64} title="Tap to change" />
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-[10px] font-bold">CHANGE</span>
                </div>
              </div>
              <p className="text-white/50 text-xs">Tap avatar to change</p>
            </div>

            <label className="flex items-center gap-2 mb-6 bg-white/5 px-4 py-3 rounded-xl border border-white/10 cursor-pointer">
              <input type="checkbox" checked={useAnyplay} onChange={(e) => setUseAnyplay(e.target.checked)} className="w-5 h-5 accent-brand" />
              <span className="text-sm font-medium text-white">Include Whot 20 (Anyplay)</span>
            </label>
            
            <div className="flex flex-col gap-3 w-full max-w-[250px]">
              <button onClick={() => startGame(true)} disabled={isStarting} className="rounded-xl bg-[#1F7A4D] border border-[#0A6B43] text-white px-8 py-4 font-semibold shadow-lg active:scale-95 transition-transform disabled:opacity-50">
                Play Solo (vs Bot)
              </button>
              <button onClick={() => startGame(false)} disabled={isStarting} className="rounded-xl bg-brand px-8 py-3 text-[0.8125rem] font-medium text-white shadow-sm active:scale-95 transition-transform disabled:opacity-50">
                {isStarting ? "Starting..." : "Host Multiplayer Game"}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col items-center relative">
            {activeGame.status === "waiting" && (
              <div className="absolute inset-0 z-20 bg-[#0B0E17] flex flex-col items-center justify-center p-6">
                <h3 className="text-white font-bold text-xl mb-2">Waiting for players...</h3>
                <p className="text-white/70 mb-6">{activeGame.players.length} / 4 joined</p>
                
                {isHost ? (
                  <p className="text-white/50 text-sm mb-6 text-center">You are the host.<br/>Waiting for others to join this room.</p>
                ) : (
                  <button onClick={joinGame} className="rounded-xl bg-brand px-8 py-3 font-semibold text-white mb-4 shadow-lg">Join Game</button>
                )}
                
                <button onClick={quitGame} className="text-white/40 text-sm hover:text-white/80">Cancel Game</button>
              </div>
            )}
            
            <div className="w-full flex-1 relative min-h-[400px]">
              <WhotGame 
                game={activeGame} 
                isPlayer={isPlayer} 
                sessionId={currentSessionId} 
                onQuit={quitGame}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}