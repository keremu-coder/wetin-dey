"use client";

import { useEffect, useRef, useState } from "react";
import { playProfile, unlockAudio, vibrate } from "@/lib/sounds";
import { WhotCard, WhotSuit, canPlayCard, WhotState, getNextTurn, startWhotGame } from "@/lib/whot";
import { getBotMove } from "@/lib/whot-bot";
import { Alama } from "./Alama";

const SvgBall = () => <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current"><circle cx="12" cy="12" r="10" /></svg>;
const SvgAngle = () => <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current"><polygon points="12,2 22,22 2,22" /></svg>;
const SvgCross = () => <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current"><path d="M12 2v20m10-10H2" stroke="currentColor" strokeWidth="4" /></svg>;
const SvgCarpet = () => <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
const SvgStar = () => <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" /></svg>;

function SuitIcon({ suit }: { suit: string }) {
  if (suit === "circle") return <SvgBall />;
  if (suit === "triangle") return <SvgAngle />;
  if (suit === "cross") return <SvgCross />;
  if (suit === "square") return <SvgCarpet />;
  if (suit === "star") return <SvgStar />;
  return null;
}

function getCardName(card: WhotCard): string {
  if (!card) return "Card";
  if (card.value === 20) return "WHOT 20";
  if (card.value === 1) return "HOLD ON";
  if (card.value === 2) return "PICK 2";
  if (card.value === 8) return card.suit === "star" ? "STAR" : "GENERAL MARKET";
  if (card.value === 14) return "GENERAL MARKET";
  return card.value + " " + card.suit.toUpperCase();
}

type VoicePref = "male" | "female" | "off";
const VOICE_KEY = "wd_voice";

function readVoice(): VoicePref {
  try {
    const v = localStorage.getItem(VOICE_KEY);
    return v === "male" || v === "off" ? v : "female";
  } catch { return "female"; }
}

function useVoicePref(): readonly [VoicePref, (v: VoicePref) => void] {
  const [v, setV] = useState<VoicePref>("female");
  useEffect(() => {
    setV(readVoice());
    const h = () => setV(readVoice());
    window.addEventListener("wd-voice", h);
    return () => window.removeEventListener("wd-voice", h);
  }, []);
  const set = (n: VoicePref) => {
    try { localStorage.setItem(VOICE_KEY, n); } catch {}
    window.dispatchEvent(new Event("wd-voice"));
  };
  return [v, set] as const;
}

function speak(text: string, pref: VoicePref) {
  if (pref === "off" || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const want = pref === "female"
      ? /female|woman|zira|samantha|susan|karen|tessa|moira|fiona|victoria|hazel/i
      : /\bmale\b|david|mark|daniel|alex|fred|george|james|oliver|tom\b/i;
    const v = voices.find((x) => /^en-NG/i.test(x.lang) && want.test(x.name)) || voices.find((x) => /^en/i.test(x.lang) && want.test(x.name)) || voices.find((x) => /^en-NG/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = v?.lang || "en-NG";
    u.pitch = pref === "female" ? 1.35 : 0.7;
    u.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

function VoiceReactions({ bubbles }: { bubbles: Record<string, string> }) {
  const [pref] = useVoicePref();
  const seen = useRef<Set<string>>(new Set());
  const key = Object.entries(bubbles).map(([id, t]) => id + ":" + t).sort().join("|");
  useEffect(() => {
    const now = new Set(Object.entries(bubbles).map(([id, t]) => id + ":" + t));
    const fresh = Array.from(now).filter((k) => !seen.current.has(k));
    seen.current = now;
    if (fresh.length > 0) {
      const first = fresh[0];
      speak(first.slice(first.indexOf(":") + 1), pref);
    }
  }, [key]);
  return null;
}

function VoiceToggle() {
  const [pref, setPref] = useVoicePref();
  const btn = (v: VoicePref, label: string, aria: string) => (
    <button type="button" aria-label={aria} aria-pressed={pref === v} onClick={() => setPref(v)} className={"h-7 min-w-7 px-2 text-xs font-bold transition-colors " + (pref === v ? "bg-amber-500 text-black" : "bg-black/40 text-amber-100/70 hover:bg-black/60")}>
      {label}
    </button>
  );
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-amber-200/30" role="group" aria-label="Reaction voice">
      {btn("male", "♂", "Male voice")}
      {btn("female", "♀", "Female voice")}
      {btn("off", "🔇", "Voice off")}
    </div>
  );
}

const RANKS = [
  { min: 60, name: "Igwe", icon: "👑", ring: "ring-fuchsia-400", chip: "bg-fuchsia-600 text-white" },
  { min: 30, name: "Chairman", icon: "🥇", ring: "ring-yellow-400", chip: "bg-yellow-500 text-black" },
  { min: 15, name: "Oga", icon: "🥈", ring: "ring-slate-300", chip: "bg-slate-300 text-black" },
  { min: 5, name: "Trader", icon: "🥉", ring: "ring-orange-400", chip: "bg-orange-600 text-white" },
  { min: 0, name: "Rookie", icon: "🎴", ring: "ring-white/30", chip: "bg-black/60 text-white/80" }
];
function rankOf(wins: number) {
  return RANKS.find((r) => wins >= r.min) || RANKS[RANKS.length - 1];
}

function computeBubbles(state: WhotState, players: string[], topCard: WhotCard | null): Record<string, string> {
  const out: Record<string, string> = {};
  const n = players.length;
  if (!state || n === 0) return out;
  const line = (seed: string, lines: string[]) => lines[Math.abs(Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0)) % lines.length];

  if (state.status === "playing") {
    for (const p of players) {
      const h = state.hands[p];
      if (h && h.length === 1) out[p] = line(p + h[0].id, ["Last card, check up!", "You dey run? Last card o!", "One card remain, oya check up!"]);
    }
    const t = players.indexOf(state.turn);
    if (topCard && t >= 0 && state.discard.length > 1) {
      const prev = players[(t - 1 + n) % n];
      const owes = state.activePenalty > 0;
      if (topCard.value === 2 && owes) {
        out[prev] = line(topCard.id, ["Oya take pick 2", "Go market my guy", "Oya go market buy me two fowl"]);
        out[state.turn] = line(topCard.id + "v", ["You go collect!", "Collect am, no vex", "You dey look? Go collect!"]);
      }
      if (topCard.value === 5 && owes) {
        out[prev] = line(topCard.id, ["Pick 3, oya enter market!", "Three fowl, oya go buy!", "Oya take pick 3, my guy"]);
        out[state.turn] = line(topCard.id + "v", ["You go collect!", "Collect am, no vex", "You dey look? Go collect!"]);
      }
      if (topCard.value === 14) out[prev] = line(topCard.id, ["General market! Everybody go collect!", "Oya, everybody go market!"]);
      
      if (n >= 3 && (topCard.value === 1 || topCard.value === 8)) {
        const played = players[(t - 2 + n) % n];
        const skipped = players[(t - 1 + n) % n];
        if (state.turn !== skipped && played !== skipped) {
          out[played] = topCard.value === 1 ? line(topCard.id, ["Oya hold on there!", "Hold on there, my guy!"]) : line(topCard.id, ["Suspension! Sit down!", "Oya sit down there!"]);
          out[skipped] = line(topCard.id + "s", ["If you move, you collect!", "You won check me?", "No move o, you go collect!"]);
        }
      }
    }
  }
  if (state.status === "finished" && state.winner) out[state.winner] = line(state.winner, ["I done win!", "Na me be oga!", "Una don see? I done win!"]);
  return out;
}

function Bubble({ text, position }: { text?: string, position?: string }) {
  if (!text) return null;
  return (
    <div className={"pointer-events-none absolute z-50 w-max max-w-[150px] rounded-xl bg-white px-3 py-1.5 text-center text-[11px] font-bold leading-tight text-black shadow-lg " + (position || "left-1/2 -top-10 -translate-x-1/2")}>
      <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white" />
      {text}
    </div>
  );
}

function WhotBack({ small }: { small?: boolean }) {
  return (
    <div className={"relative flex shrink-0 items-center justify-center overflow-hidden rounded border-2 border-[#d9a35b] bg-[#8B3A35] shadow-sm " + (small ? "h-10 w-7" : "h-20 w-14")}>
      <span className={"-rotate-45 font-black tracking-widest text-[#f5d9a8] " + (small ? "text-[8px]" : "text-xs")}>WHOT</span>
    </div>
  );
}

function Seat({ name, count, isTurn, wins, bubble, seed }: { name: string; count: number; isTurn: boolean; wins: number; bubble?: string; seed: string }) {
  const rank = rankOf(wins);
  return (
    <div className={"relative flex flex-col items-center transition-all duration-300 " + (isTurn ? "scale-105" : "opacity-70")}>
      <div className={"rounded-full ring-2 " + (isTurn ? "ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : rank.ring)}>
        <Alama seed={seed} size={38} />
      </div>
      <span className={"mt-1 max-w-[70px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold " + (isTurn ? "bg-amber-400 text-black" : "bg-black/60 text-white/80")}>{name}</span>
      <span className={"mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide " + rank.chip}>{rank.icon} {rank.name}</span>
      <div className="mt-1 flex -space-x-2">
        {Array.from({ length: Math.min(count, 3) }).map((_, i) => <WhotBack key={i} small />)}
        {count > 3 ? <span className="pl-3 text-[10px] font-bold text-white/80">+{count - 3}</span> : null}
      </div>
      {bubble && <Bubble text={bubble} position="left-1/2 -top-12 -translate-x-1/2" />}
    </div>
  );
}

export function WhotGame({ game, isPlayer, sessionId, onQuit, mySeed }: { game: any, isPlayer: boolean, sessionId: string, onQuit: () => void, mySeed?: string }) {
  const [state, setState] = useState<WhotState>(game.game_state);
  const [selectedCard, setSelectedCard] = useState<WhotCard | null>(null);
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [calledSuit, setCalledSuit] = useState<WhotSuit | null>(null);
  const [lastAction, setLastAction] = useState("Game started!");
  const [isProcessing, setIsProcessing] = useState(false);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  useEffect(() => {
    if (game.game_state) setState(game.game_state);
  }, [game.game_state]);

  const handles: Record<string, string> = game.handles ?? {};
  const nameOf = (id: string): string => id === "bot" ? "🤖 Bot" : handles[id] ? "@" + handles[id] : "Player";
  const myHandle = nameOf(sessionId);

  const myIdx = game.players.indexOf(sessionId);
  const ordered: string[] = myIdx < 0 ? [...game.players] : [...game.players.slice(myIdx + 1), ...game.players.slice(0, myIdx)];
  const opponents = ordered.filter((p: string) => p !== sessionId);

  const myHand = state.hands[sessionId] || [];
  const topCard: WhotCard = state.discard.length > 0 ? state.discard[state.discard.length - 1] : null as any;
  const isMyTurn = state.turn === sessionId && state.status === "playing";
  const isBotTurn = state.turn === "bot" && state.status === "playing";

  async function syncState(newState: WhotState) {
    setState(newState);
    await fetch("/api/space-games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "update_state", gameId: game.id, game_state: newState })
    });
  }

  useEffect(() => {
    if (!isBotTurn || isProcessing) return;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      const opponentCardCounts = game.players.filter((p: string) => p !== "bot").map((p: string) => state.hands[p]?.length || 0);
      const move = getBotMove(state.hands["bot"] || [], topCard, state.calledSuit, state.activePenalty, state.penaltyType, opponentCardCounts);
      
      let newState = { ...state };
      let newHands = { ...state.hands };
      let newDeck = [...state.deck];
      
      if (!move || move.action === "pick") {
        const drawAmount = state.activePenalty > 0 ? state.activePenalty : 1;
        if (newDeck.length < drawAmount) newDeck = [...newDeck, ...state.discard.slice(0, -1).sort(() => Math.random() - 0.5)];
        const drawn = newDeck.splice(0, drawAmount);
        newHands["bot"] = [...(newHands["bot"] || []), ...drawn];
        newState = { ...state, deck: newDeck, hands: newHands, turn: getNextTurn(game.players, "bot"), activePenalty: 0, penaltyType: null };
        setLastAction("🤖 Bot picked " + drawAmount + " card(s).");
      } else if (move.action === "play") {
        const newHand = (newHands["bot"] || []).filter(c => c.id !== move.card?.id);
        newHands["bot"] = newHand;
        let nextTurn = getNextTurn(game.players, "bot");
        let activePenalty = state.activePenalty;
        let penaltyType = state.penaltyType;
        let actionText = "🤖 Bot played " + getCardName(move.card!);

        if (move.card!.value === 2) {
          activePenalty = (penaltyType === "2" ? activePenalty : 0) + 2; penaltyType = "2";
          actionText += " (Stack: " + activePenalty + ")";
        } else if (move.card!.value === 1 || move.card!.value === 8) {
          const botIdx = game.players.indexOf("bot");
          nextTurn = game.players[(botIdx + 2) % game.players.length];
          activePenalty = 0; penaltyType = null; actionText += ". Next player suspended!";
        } else if (move.card!.value === 14) {
          for (const p of game.players) {
            if (p !== "bot") {
              if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);
              const drawn = newDeck.splice(0, 1); newHands[p] = [...(newHands[p] || []), ...drawn];
            }
          }
          nextTurn = "bot"; activePenalty = 0; penaltyType = null; actionText += ". Everyone picks 1!";
        } else { activePenalty = 0; penaltyType = null; }

        newState = { ...state, deck: newDeck, hands: newHands, discard: [...state.discard, move.card!], turn: nextTurn, calledSuit: move.calledSuit || null, winner: newHand.length === 0 ? "bot" : null, status: newHand.length === 0 ? "finished" : "playing", activePenalty, penaltyType };
        setLastAction(actionText);
      }
      
      playProfile("bbm", "receive");
      await syncState(newState);
      setIsProcessing(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isBotTurn, state, isProcessing, game.players]);

  function handleCardClick(card: WhotCard) {
    if (!isMyTurn || isProcessing) return;
    if (!canPlayCard(card, topCard, state.calledSuit, state.activePenalty, state.penaltyType)) return;
    if (card.suit === "whot") { setSelectedCard(card); setSuitPickerOpen(true); }
    else { playCard(card, null); }
  }

  async function handleSuitPick(suit: WhotSuit) {
    if (selectedCard) await playCard(selectedCard, suit);
    setSuitPickerOpen(false);
  }

  async function playCard(card: WhotCard, suit: WhotSuit | null) {
    setIsProcessing(true);
    const newHand = (state.hands[sessionId] || []).filter(c => c.id !== card.id);
    let newHands = { ...state.hands, [sessionId]: newHand };
    let newDeck = [...state.deck];
    let nextTurn = getNextTurn(game.players, sessionId);
    let activePenalty = state.activePenalty;
    let penaltyType = state.penaltyType;
    let actionText = "You played " + getCardName(card);

    if (card.value === 2) {
      activePenalty = (penaltyType === "2" ? activePenalty : 0) + 2; penaltyType = "2"; actionText += " (Stack: " + activePenalty + ")";
    } else if (card.value === 1 || card.value === 8) {
      nextTurn = game.players[(myIdx + 2) % game.players.length]; activePenalty = 0; penaltyType = null; actionText += ". Next player suspended!";
    } else if (card.value === 14) {
      for (const p of game.players) {
        if (p !== sessionId) {
          if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);
          const drawn = newDeck.splice(0, 1); newHands[p] = [...(newHands[p] || []), ...drawn];
        }
      }
      nextTurn = sessionId; activePenalty = 0; penaltyType = null; actionText += ". Everyone picks 1!";
    } else { activePenalty = 0; penaltyType = null; }

    const newState: WhotState = { ...state, deck: newDeck, hands: newHands, discard: [...state.discard, card], turn: nextTurn, calledSuit: suit, winner: newHand.length === 0 ? sessionId : null, status: newHand.length === 0 ? "finished" : "playing", activePenalty, penaltyType };
    setLastAction(actionText); playProfile("bbm", "send"); vibrate(30);
    await syncState(newState); setSelectedCard(null); setIsProcessing(false);
  }

  async function pickFromMarket() {
    if (!isMyTurn || isProcessing) return;
    setIsProcessing(true);
    let newDeck = [...state.deck];
    let newHand = [...(state.hands[sessionId] || [])];
    const drawAmount = state.activePenalty > 0 ? state.activePenalty : 1;
    if (newDeck.length < drawAmount) newDeck = [...newDeck, ...state.discard.slice(0, -1).sort(() => Math.random() - 0.5)];
    const drawn = newDeck.splice(0, drawAmount); newHand.push(...drawn);
    const newState = { ...state, deck: newDeck, hands: { ...state.hands, [sessionId]: newHand }, turn: getNextTurn(game.players, sessionId), activePenalty: 0, penaltyType: null };
    setLastAction("You picked " + drawAmount + " card(s)."); playProfile("bbm", "send");
    await syncState(newState); setIsProcessing(false);
  }

  if (!state || !state.hands) return <div className="text-center text-white p-4">Dealing cards...</div>;

  return ((bubbles: Record<string, string>) => (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden bg-[#1a0f0a]">
      <VoiceReactions bubbles={bubbles} />

      {/* Main Table Area (Terracotta/African Mat style, NO GREEN FELT) */}
      <div className="m-1 flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-[#5c3a21] bg-[#2A1B12] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)] relative">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-[#5c3a21] shrink-0">
          <div className="flex items-center gap-2">
            <Alama seed={mySeed || sessionId} size={28} />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-amber-50">{myHandle}</span>
              <span className="text-[8px] text-amber-200/60">{myHand.length} cards left</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center bg-black/50 px-2 py-0.5 rounded border border-white/10">
              <span className="text-[7px] text-amber-500 uppercase tracking-widest font-bold">Score</span>
              <div className="flex gap-2 font-mono font-bold text-[10px]">
                <span className="text-green-500">{wins}W</span>
                <span className="text-red-500">{losses}L</span>
              </div>
            </div>
            <button onClick={onQuit} className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow transition-transform active:scale-90">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Opponents Area */}
        <div className="flex justify-center gap-6 px-3 py-3 shrink-0">
          {opponents.slice(0, 3).map((opp) => (
            <Seat key={opp} seed={opp} name={nameOf(opp)} count={state.hands[opp]?.length || 0} isTurn={state.turn === opp && state.status === "playing"} wins={Number(game.ranks?.[opp] ?? 0)} bubble={bubbles[opp]} />
          ))}
        </div>

        {/* Center Table Area (Market & Discard) */}
        <div className="flex-1 flex flex-col items-center justify-center relative min-h-[160px]">
          {isMyTurn && (
            <div className="absolute top-2 z-10 animate-bounce">
              <span className="bg-amber-500 text-black text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)] border border-amber-300">
                Your Turn
              </span>
            </div>
          )}

          <div className="flex items-center gap-8 mt-2">
            <button onClick={pickFromMarket} disabled={!isMyTurn || isProcessing} className={"flex flex-col items-center transition-transform " + (isMyTurn ? "active:scale-95" : "opacity-60")}>
              <WhotBack />
              <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-black/50 px-2 py-0.5 rounded-full">Market ({state.deck.length})</span>
            </button>

            <div className="relative h-20 w-14">
              {state.discard.slice(-2).map((c, i, arr) => (
                <div key={c.id} className="absolute inset-0 transition-transform duration-300" style={{ transform: "rotate(" + (i === arr.length - 1 ? 0 : -8) + "deg)" }}>
                  <div className="flex h-full w-full flex-col justify-between rounded border border-black/20 bg-[#fdfbf7] p-1 text-[#8B3A35] shadow-xl">
                    <div className="text-xs font-bold leading-none">{c.value}</div>
                    <div className="flex scale-75 justify-center">{c.suit === "whot" ? <span className="text-xs font-black">WHOT</span> : <SuitIcon suit={c.suit} />}</div>
                    <div className="self-end rotate-180 text-xs font-bold leading-none">{c.value}</div>
                  </div>
                </div>
              ))}
              {state.calledSuit && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-300">Play: {state.calledSuit}</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: My Hand & Controls */}
        <div className="shrink-0 bg-black/30 pt-2 pb-1 px-2 border-t border-[#5c3a21] relative z-20">
          
          {/* Controls Row */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className={"rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest " + (isMyTurn ? "bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-black/50 text-white/70")}>
              {isMyTurn ? "Your turn" : lastAction}
            </span>
            <VoiceToggle />
          </div>

          {/* Fanned Hand */}
          <div className="relative mx-auto h-24 w-full max-w-sm">
            {myHand.map((card, index) => {
              const n = myHand.length;
              const mid = (n - 1) / 2;
              const spread = Math.min(30, 240 / Math.max(n, 1));
              const rot = (index - mid) * Math.min(6, 40 / Math.max(n, 1));
              const dy = Math.pow(Math.abs(index - mid), 2) * 1.2;
              const playable = isMyTurn && canPlayCard(card, topCard, state.calledSuit, state.activePenalty, state.penaltyType);
              const lift = selectedCard?.id === card.id ? -18 : playable ? -8 : 0;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardClick(card)}
                  aria-label={getCardName(card)}
                  className={"absolute bottom-0 left-1/2 -ml-8 origin-bottom transition-transform duration-200 " + (isMyTurn && !playable ? "opacity-60 saturate-50" : "")}
                  style={{ transform: "translateX(" + (index - mid) * spread + "px) translateY(" + (dy + lift) + "px) rotate(" + rot + "deg)", zIndex: index }}
                >
                  <div className={"flex h-20 w-14 flex-col justify-between rounded border bg-[#fdfbf7] p-1 text-[#8B3A35] shadow-lg " + (playable ? "border-amber-400" : "border-black/20")}>
                    <div className="text-left text-xs font-bold leading-none">{card.value}</div>
                    <div className="flex scale-75 justify-center">{card.suit === "whot" ? <span className="text-xs font-black">WHOT</span> : <SuitIcon suit={card.suit} />}</div>
                    <div className="self-end rotate-180 text-xs font-bold leading-none">{card.value}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {bubbles[sessionId] && <Bubble text={bubbles[sessionId]} position="left-4 bottom-28" />}
        </div>

      </div>

      {/* Suit picker */}
      {suitPickerOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 rounded-2xl border border-amber-700/50 bg-[#2A1B12] p-4 text-center shadow-2xl">
            <h3 className="mb-3 text-sm font-bold text-amber-100">Pick a Suit</h3>
            <div className="flex gap-3">
              {(["circle", "triangle", "cross", "star", "square"] as const).map((s) => (
                <button key={s} type="button" onClick={() => handleSuitPick(s)} aria-label={s} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white transition-transform hover:border-amber-500 active:scale-90">
                  <div className="scale-75"><SuitIcon suit={s} /></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game over */}
      {state.status === "finished" && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <div className="mb-3 text-6xl">{state.winner === sessionId ? "🏆" : "😔"}</div>
          <h2 className="text-2xl font-black text-white">{state.winner === sessionId ? "You won!" : nameOf(state.winner || "") + " won!"}</h2>
          <p className="mt-2 text-sm text-white/60">Enjoyed it? Bring your people to the table.</p>
          <div className="mt-5 flex w-full max-w-[260px] flex-col gap-3">
            <button type="button" onClick={onQuit} className="rounded-2xl border border-white/30 px-6 py-3 text-base font-bold text-white active:scale-95">Back to lobby</button>
          </div>
        </div>
      )}
    </div>
  ))(computeBubbles(state, game.players, topCard));
}