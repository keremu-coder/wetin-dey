"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, useConnectionState, useLocalParticipant, useParticipants } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import { getBrowserClient } from "@/lib/supabase/client";
import { WhotGame } from "./WhotGame";
import { startWhotGame } from "@/lib/whot";
import { Alama } from "./Alama";

const AVATAR_SEEDS = ["mama", "oga", "boy", "lady", "pastor", "alhaji", "market_woman", "area_boy", "musa", "chioma"];

function CustomAudioBar({ spaceName, onLeave }: { spaceName: string, onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [isMuted, setIsMuted] = useState(true);

  async function toggleMute() {
    if (!localParticipant) return;
    const nextState = !isMuted;
    setIsMuted(nextState);
    await localParticipant.setMicrophoneEnabled(!nextState);
  }

  return (
    <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/10 mx-4 mb-2">
      <div className="flex -space-x-2 overflow-hidden px-2">
        {participants.map(p => (
          <div key={p.identity} className="relative inline-block h-8 w-8 rounded-full ring-2 ring-[#0B0E17]">
             <Alama seed={p.identity} size={32} />
             {p.isSpeaking && <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-pulse" />}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pr-1">
        <button onClick={toggleMute} className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
          {isMuted ? "🔇" : "🎙️"}
        </button>
        <button onClick={onLeave} className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400">
          ✕
        </button>
      </div>
    </div>
  );
}

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
  
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mySeed, setMySeed] = useState("oga");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  useEffect(() => {
    const savedSeed = localStorage.getItem("whot_avatar_seed");
    if (savedSeed) setMySeed(savedSeed);
  }, []);

  function pickAvatar(seed: string) {
    setMySeed(seed);
    localStorage.setItem("whot_avatar_seed", seed);
    setShowAvatarPicker(false);
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
    if (activeGame.players.length >= 4) return; // Max 4
    if (activeGame.players.includes(currentSessionId)) return;
    if (activeGame.status !== "waiting") return;

    const newPlayers = [...activeGame.players, currentSessionId];
    const newState = startWhotGame(newPlayers, activeGame.game_state.useAnyplay);
    const newStatus = newPlayers.length >= 2 ? "playing" : "waiting"; // Min 2 to start

    const supabase = getBrowserClient();
    await supabase
      .from("space_games")
      .update({ players: newPlayers, game_state: newState, status: newStatus })
      .eq("id", activeGame.id);
  }

  async function quitGame() {
    if (!activeGame) return;
    const gameId = activeGame.id;
    
    // Instantly clear the UI
    setActiveGame(null);
    
    // Delete from database in the background
    const supabase = getBrowserClient();
    try {
      await supabase.from("space_games").delete().eq("id", gameId);
    } catch (err) {
      console.error("Failed to delete game", err);
    }
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
      className={`fixed inset-x-0 bottom-0 z-[200] flex flex-col bg-[#0B0E17] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 transition-all duration-300 ${isFullScreen ? 'h-[100dvh] rounded-none' : 'h-[70vh]'}`}
    >
      {/* Drag Handle */}
      <div className="w-full flex justify-center py-2 shrink-0 cursor-pointer" onClick={onClose}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full" />
      </div>

      <header className="flex items-center justify-between px-4 pb-2 shrink-0">
        <div className="min-w-0 pr-4">
          <h2 className="font-serif text-[1.1rem] font-semibold text-white truncate">{spaceName} Voice</h2>
          <p className="text-[0.75rem] text-white/50">Live Game Room</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setIsFullScreen(!isFullScreen)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20">
            {isFullScreen ? "↓" : "↑"}
          </button>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Audio Bar */}
      <LiveKitRoom 
        video={false} 
        audio={true} 
        token={token} 
        serverUrl={livekitUrl} 
        onDisconnected={() => setLivekitError(true)} 
        onError={() => setLivekitError(true)}
        data-lk-theme="default" 
        style={{ height: 'auto' }}
      >
        {livekitError ? (
          <div className="flex items-center justify-center text-red-400 text-sm font-semibold mx-4 mb-2 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            Audio failed to connect.
          </div>
        ) : (
          <CustomAudioBar spaceName={spaceName} onLeave={onClose} />
        )}
      </LiveKitRoom>

      <div className="flex-1 flex flex-col p-4 overflow-y-auto relative bg-[#0B0E17]">
        {!activeGame ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            
            {/* Avatar Picker */}
            <div className="relative mb-6">
              <div 
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              >
                <div className="relative">
                  <Alama seed={mySeed} size={72} title="Change Avatar" />
                  <div className="absolute bottom-0 right-0 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white">Edit</div>
                </div>
                <p className="text-white/50 text-xs mt-2">Tap to change character</p>
              </div>

              {showAvatarPicker && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-surface border border-border-strong p-3 rounded-2xl shadow-2xl z-50 w-[280px]">
                  <p className="text-ink text-xs font-bold mb-2 text-center">Choose your character</p>
                  <div className="grid grid-cols-5 gap-2">
                    {AVATAR_SEEDS.map(seed => (
                      <button key={seed} onClick={() => pickAvatar(seed)} className={`rounded-full p-0.5 transition-all ${mySeed === seed ? 'ring-2 ring-brand' : 'hover:scale-110'}`}>
                        <Alama seed={seed} size={40} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                mySeed={mySeed}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}