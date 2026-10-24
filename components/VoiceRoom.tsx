"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, useConnectionState, useLocalParticipant, useParticipants, StartMediaButton, RoomAudioRenderer } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import { WhotGame } from "./WhotGame";
import { startWhotGame } from "@/lib/whot";
import { Alama } from "./Alama";

const AVATAR_SEEDS = ["mama", "oga", "boy", "lady", "pastor", "alhaji", "market_woman", "area_boy", "musa", "chioma"];

function CustomAudioBar({ spaceName, onLeave }: { spaceName: string, onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [isMuted, setIsMuted] = useState(false);

  async function toggleMute() {
    if (!localParticipant) return;
    const nextState = !isMuted;
    setIsMuted(nextState);
    await localParticipant.setMicrophoneEnabled(!nextState);
    
    // Force resume all audio elements to bypass autoplay blocks
    document.querySelectorAll('audio').forEach(a => {
      a.play().catch(() => {});
    });
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
  dmThreadId,
  currentSessionId,
  onClose,
}: {
  roomName: string;
  spaceName: string;
  communityId?: string;
  dmThreadId?: string;
  currentSessionId: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeGame, setActiveGame] = useState<any>(null);
  const [useAnyplay, setUseAnyplay] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [livekitError, setLivekitError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
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
  }, [roomName, livekitUrl, retryCount]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/space-games", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "get", communityId, dmThreadId })
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setActiveGame(json.game ? { ...json.game, handles: json.handles ?? {} } : null);
      } catch { /* retry on next tick */ }
    }
    void load();
    const t = setInterval(load, 1500);
    return () => { cancelled = true; clearInterval(t); };
  }, [communityId, dmThreadId]);

  async function startGame(withBot: boolean = false) {
    if (isStarting) return;
    setIsStarting(true);

    const players = withBot ? [currentSessionId, "bot"] : [currentSessionId];
    const initialState = startWhotGame(players, useAnyplay);

    try {
      const res = await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "start",
          communityId,
          dmThreadId,
          players,
          game_state: initialState
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.game) {
        alert("Could not start game. Try again.");
        setIsStarting(false);
      } else {
        setActiveGame(json.game);
      }
    } catch {
      alert("Could not start game. Check your connection.");
      setIsStarting(false);
    }
  }

  async function gameAction(action: string, extra: Record<string, unknown> = {}) {
    try { await fetch("/api/space-games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, gameId: activeGame?.id, ...extra }) }); } catch {}
  }
  async function joinGame() { if (!activeGame || activeGame.status !== "waiting") return; await gameAction("join"); }
  async function beginGame() { if (!activeGame || activeGame.status !== "waiting") return; await gameAction("begin"); }
  async function leaveLobby() { const id = activeGame?.id; if (!id) return; setActiveGame(null); await gameAction("leave", { gameId: id }); }
  async function inviteFriends() {
    const url = window.location.origin + "/c/" + roomName + "/chat?play=1";
    try { if (navigator.share) { await navigator.share({ title: "Whot on Wetin Dey", text: "Come play Whot with me", url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); setInviteNote("Link copied!"); } catch { window.prompt("Copy link", url); }
    setTimeout(() => setInviteNote(""), 2500);
  }
  async function quitGame() {
    if (!activeGame) return;
    const gameId = activeGame.id;
    
    // Instantly clear the UI
    setActiveGame(null);
    
    // Delete from database in the background
    try {
      await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", gameId })
      });
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

  const maxPlayers = dmThreadId ? 2 : 4;
  const isPlayer = activeGame?.players?.includes(currentSessionId);
  const isHost = activeGame?.created_by === currentSessionId;

  return (
    <div 
      className={`fixed inset-x-0 bottom-0 z-[200] flex flex-col bg-[#0B0E17] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 transition-all duration-300 ${isFullScreen ? 'h-[100dvh] rounded-none' : 'h-[55vh]'}`}
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
          {/* Quick Chat Button */}
          <button 
            onClick={onClose} 
            className="flex h-8 items-center justify-center rounded-full bg-white/10 px-3 text-white/70 hover:bg-white/20 text-xs font-semibold"
          >
            Chat
          </button>
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
        onError={(e) => { console.error("LiveKit Error:", e); setLivekitError(true); }}
        data-lk-theme="default" 
        style={{ height: 'auto' }}
      >
        <RoomAudioRenderer />
        <div className="flex justify-center mt-2 mb-1">
          <StartMediaButton label="🔊 Tap to hear voice" className="bg-brand text-white px-4 py-2 rounded-full text-sm font-semibold animate-pulse" />
        </div>
        {livekitError ? (
              <div className="absolute inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <h3 className="text-white text-xl font-bold mb-2">Audio failed to connect</h3>
                <p className="text-white/60 mb-6 text-sm max-w-xs">Make sure you have a stable internet connection and your mic permissions are allowed.</p>
                <button onClick={() => { setLivekitError(false); setToken(null); setRetryCount(c => c + 1); }} className="bg-brand text-white px-6 py-3 rounded-full font-bold mb-3 w-full max-w-xs">Retry Connection</button>
                <button onClick={onClose} className="text-white/50 underline text-sm">Leave room</button>
              </div>
            ) : null}
      </LiveKitRoom>

      <div className="flex-1 flex flex-col p-4 overflow-y-auto relative bg-[#0B0E17]">
        {!activeGame ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            
            {/* Avatar Picker */}
            <div className="relative mb-4">
              <div 
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              >
                <div className="relative">
                  <Alama seed={mySeed} size={64} title="Change Avatar" />
                  <div className="absolute bottom-0 right-0 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white">Edit</div>
                </div>
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

            <label className="flex items-center gap-2 mb-4 bg-white/5 px-4 py-2 rounded-xl border border-white/10 cursor-pointer">
              <input type="checkbox" checked={useAnyplay} onChange={(e) => setUseAnyplay(e.target.checked)} className="w-4 h-4 accent-brand" />
              <span className="text-xs font-medium text-white">Include Whot 20</span>
            </label>
            
            <div className="flex flex-col gap-2 w-full max-w-[250px]">
              <button onClick={() => startGame(true)} disabled={isStarting} className="rounded-xl bg-[#1F7A4D] border border-[#0A6B43] text-white px-8 py-3 font-semibold shadow-lg active:scale-95 transition-transform disabled:opacity-50 text-sm">
                Play Solo (vs Bot)
              </button>
              <button onClick={() => startGame(false)} disabled={isStarting} className="rounded-xl bg-brand px-8 py-2.5 text-[0.8125rem] font-medium text-white shadow-sm active:scale-95 transition-transform disabled:opacity-50">
                {isStarting ? "Starting..." : dmThreadId ? "Start Private Game" : "Host Multiplayer Game"}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col items-center relative">
            {activeGame.status === "waiting" && (
              <div className="absolute inset-0 z-20 bg-[#0B0E17] flex flex-col items-center justify-center p-6 overflow-y-auto">
                <h3 className="text-white font-bold text-xl mb-1">Whot lobby</h3>
                <p className="text-white/70 mb-4 text-base">{activeGame.players.length} / {maxPlayers} joined</p>
                <ul className="w-full max-w-[300px] mb-5 space-y-2">
                  {activeGame.players.map((p: string) => (
                    <li key={p} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                      <Alama seed={p === currentSessionId ? mySeed : p} size={32} />
                      <span className="text-white text-base font-semibold truncate">
                        {activeGame.handles?.[p] ? "@" + activeGame.handles[p] : "Player"}
                        {p === currentSessionId ? " (you)" : ""}
                        {p === activeGame.created_by ? " · host" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {!isPlayer ? (<button onClick={joinGame} className="rounded-xl bg-brand px-8 py-3 text-base font-semibold text-white mb-4 shadow-lg">Join Game</button>) : isHost ? (
                  <button onClick={beginGame} disabled={activeGame.players.length < 2} className="rounded-xl bg-[#1F7A4D] px-8 py-3 text-base font-semibold text-white mb-2 shadow-lg disabled:opacity-40">{activeGame.players.length < 2 ? "Waiting for a second player" : "Start game (" + activeGame.players.length + " players)"}</button>
                ) : (<p className="text-white/60 text-sm mb-4 text-center">Waiting for host to start.</p>)}
                {!dmThreadId && communityId ? (<button onClick={inviteFriends} className="rounded-xl border border-white/20 px-6 py-2.5 text-sm font-semibold text-white mb-2">Invite friends</button>) : null}
                {inviteNote ? <p className="text-green-400 text-sm mb-2">{inviteNote}</p> : null}
                <button onClick={isHost ? quitGame : leaveLobby} className="text-white/50 text-sm hover:text-white/80 mt-2">{isHost ? "Cancel game" : "Leave"}</button>
              </div>
            )}
            <div className="w-full flex-1 relative min-h-[350px]">
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