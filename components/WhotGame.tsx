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
    <button type="button" aria-label={aria} aria-pressed={pref === v} onClick={() => setPref(v)} className={"h-8 min-w-8 px-2 text-sm font-bold " + (pref === v ? "bg-amber-500 text-black" : "bg-black/40 text-amber-100/70")}>
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

function Bubble({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-1 w-max max-w-[130px] -translate-x-1/2 rounded-xl bg-white px-2 py-1 text-center text-[11px] font-bold leading-tight text-black shadow-lg">
      <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white" />
      {text}
    </div>
  );
}

function WhotBack({ small }: { small?: boolean }) {
  return (
    <div className={"relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-[#d9a35b] bg-[#8B3A35] shadow-md " + (small ? "h-9 w-6" : "h-24 w-16")}>
      <span className={"-rotate-45 font-black tracking-widest text-[#f5d9a8] " + (small ? "text-[7px]" : "text-sm")}>WHOT</span>
    </div>
  );
}

function Seat({ name, count, isTurn, wins, bubble, seed }: { name: string; count: number; isTurn: boolean; wins: number; bubble?: string; seed: string }) {
  const rank = rankOf(wins);
  return (
    <div className={"relative flex w-24 flex-col items-center transition-all duration-300 " + (isTurn ? "scale-105" : "opacity-80")}>
      <div className={"rounded-full ring-4 " + (isTurn ? "ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)]" : rank.ring)}>
        <Alama seed={seed} size={40} />
      </div>
      <span className={"mt-1 max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-bold " + (isTurn ? "bg-amber-400 text-black" : "bg-black/60 text-white/80")}>{name}</span>
      <span className={"mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide " + rank.chip}>{rank.icon} {rank.name}</span>
      <div className="mt-1 flex -space-x-3">
        {Array.from({ length: Math.min(count, 5) }).map((_, i) => <WhotBack key={i} small />)}
        {count > 5 ? <span className="pl-4 text-[10px] font-bold text-white/80">+{count - 5}</span> : null}
      </div>
      <Bubble text={bubble} />
    </div>
  );
}

function PostGameActions({ onQuit, canInvite }: { onQuit: () => void; canInvite: boolean }) {
  const [note, setNote] = useState("");
  async function invite() {
    const url = window.location.origin + window.location.pathname + "?play=1";
    const text = "Come play Whot with me on Wetin Dey";
    try {
      if (navigator.share) { await navigator.share({ title: "Whot on Wetin Dey", text, url }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(url); setNote("Link copied. Send it to your friends."); }
    catch { window.prompt("Copy this link and send it to your friends", url); }
  }
  return (
    <div className="mt-5 flex w-full max-w-[260px] flex-col gap-3">
      {canInvite ? (
        <button type="button" onClick={invite} className="rounded-2xl bg-amber-500 px-6 py-3 text-base font-extrabold text-black active:scale-95">
          Invite friends to play
        </button>
      ) : null}
      {note ? <p className="text-center text-sm text-green-300">{note}</p> : null}
      <button type="button" onClick={onQuit} className="rounded-2xl border border-white/30 px-6 py-3 text-base font-bold text-white active:scale-95">
        Back to lobby
      </button>
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
  const [hasDeclaredLastCard, setHasDeclaredLastCard] = useState(false);
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
      const move = getBotMove(
        state.hands["bot"] || [],
        topCard,
        state.calledSuit,
        state.activePenalty,
        state.penaltyType,
        opponentCardCounts
      );
      
      let newState = { ...state };
      let newHands = { ...state.hands };
      let newDeck = [...state.deck];
      
      if (!move || move.action === "pick") {
        const drawAmount = state.activePenalty > 0 ? state.activePenalty : 1;
        if (newDeck.length < drawAmount) newDeck = [...newDeck, ...state.discard.slice(0, -1).sort(() => Math.random() - 0.5)];
        const drawn = newDeck.splice(0, drawAmount);
        newHands["bot"] = [...(newHands["bot"] || []), ...drawn];
        
        newState = {
          ...state,
          deck: newDeck,
          hands: newHands,
          turn: getNextTurn(game.players, "bot"),
          activePenalty: 0,
          penaltyType: null
        };
        setLastAction("🤖 Bot picked " + drawAmount + " card(s).");
      } else if (move.action === "play") {
        const newHand = (newHands["bot"] || []).filter(c => c.id !== move.card?.id);
        newHands["bot"] = newHand;
        
        let nextTurn = getNextTurn(game.players, "bot");
        let activePenalty = state.activePenalty;
        let penaltyType = state.penaltyType;
        let actionText = "🤖 Bot played " + getCardName(move.card!);

        if (move.card!.value === 2) {
          activePenalty = (penaltyType === "2" ? activePenalty : 0) + 2;
          penaltyType = "2";
          actionText += " (Stack: " + activePenalty + ")";
        } else if (move.card!.value === 1 || move.card!.value === 8) {
          const botIdx = game.players.indexOf("bot");
          nextTurn = game.players[(botIdx + 2) % game.players.length];
          activePenalty = 0; penaltyType = null;
          actionText += ". Next player suspended!";
        } else if (move.card!.value === 14) {
          for (const p of game.players) {
            if (p !== "bot") {
              if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);
              const drawn = newDeck.splice(0, 1);
              newHands[p] = [...(newHands[p] || []), ...drawn];
            }
          }
          nextTurn = "bot";
          activePenalty = 0; penaltyType = null;
          actionText += ". Everyone picks 1!";
        } else {
          activePenalty = 0; penaltyType = null;
        }

        newState = {
          ...state,
          deck: newDeck,
          hands: newHands,
          discard: [...state.discard, move.card!],
          turn: nextTurn,
          calledSuit: move.calledSuit || null,
          winner: newHand.length === 0 ? "bot" : null,
          status: newHand.length === 0 ? "finished" : "playing",
          activePenalty,
          penaltyType
        };
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
    
    if (card.suit === "whot") {
      setSelectedCard(card);
      setSuitPickerOpen(true);
    } else {
      playCard(card, null);
    }
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
      activePenalty = (penaltyType === "2" ? activePenalty : 0) + 2;
      penaltyType = "2";
      actionText += " (Stack: " + activePenalty + ")";
    } else if (card.value === 1 || card.value === 8) {
      nextTurn = game.players[(myIdx + 2) % game.players.length];
      activePenalty = 0; penaltyType = null;
      actionText += ". Next player suspended!";
    } else if (card.value === 14) {
      for (const p of game.players) {
        if (p !== sessionId) {
          if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);
          const drawn = newDeck.splice(0, 1);
          newHands[p] = [...(newHands[p] || []), ...drawn];
        }
      }
      nextTurn = sessionId;
      activePenalty = 0; penaltyType = null;
      actionText += ". Everyone picks 1!";
    } else {
      activePenalty = 0; penaltyType = null;
    }

    const newState: WhotState = {
      ...state,
      deck: newDeck,
      hands: newHands,
      discard: [...state.discard, card],
      turn: nextTurn,
      calledSuit: suit,
      winner: newHand.length === 0 ? sessionId : null,
      status: newHand.length === 0 ? "finished" : "playing",
      activePenalty,
      penaltyType
    };
    
    setLastAction(actionText);
    playProfile("bbm", "send");
    vibrate(30);
    await syncState(newState);
    setSelectedCard(null);
    setIsProcessing(false);
  }

  async function pickFromMarket() {
    if (!isMyTurn || isProcessing) return;
    setIsProcessing(true);
    let newDeck = [...state.deck];
    let newHand = [...(state.hands[sessionId] || [])];
    
    const drawAmount = state.activePenalty > 0 ? state.activePenalty : 1;
    if (newDeck.length < drawAmount) newDeck = [...newDeck, ...state.discard.slice(0, -1).sort(() => Math.random() - 0.5)];
    const drawn = newDeck.splice(0, drawAmount);
    newHand.push(...drawn);
    
    const newState = {
      ...state,
      deck: newDeck,
      hands: { ...state.hands, [sessionId]: newHand },
      turn: getNextTurn(game.players, sessionId),
      activePenalty: 0,
      penaltyType: null,
    };
    setLastAction("You picked " + drawAmount + " card(s).");
    playProfile("bbm", "send");
    await syncState(newState);
    setIsProcessing(false);
  }

  if (!state || !state.hands) return <div className="text-center text-white p-4">Dealing cards...</div>;

  return ((bubbles: Record<string, string>) => (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden rounded-xl bg-[#1a0f0a]">
      <VoiceReactions bubbles={bubbles} />

      {/* Thick wooden rim */}
      <div className="m-1.5 flex min-h-[320px] flex-1 flex-col rounded-[2rem] bg-gradient-to-br from-[#7a4f2a] via-[#5a3a1e] to-[#3b2412] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.7)]">

        {/* Green felt */}
        <div className="relative flex-1 overflow-hidden rounded-[1.4rem] bg-[radial-gradient(ellipse_at_center,#1f7a3f_0%,#14572c_55%,#0b3a1c_100%)] shadow-[inset_0_0_40px_rgba(0,0,0,0.75)]">

          {/* Red X quit, top right */}
          <button
            type="button"
            onClick={onQuit}
            aria-label="Quit game"
            className="absolute right-2 top-2 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-2 ring-white/40 active:scale-90"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {/* Up to 3 opponents */}
          {(() => {
            const slots = opponents.length === 1 ? ["top"] : opponents.length === 2 ? ["left", "right"] : ["left", "top", "right"];
            const pos: Record<string, string> = {
              top: "left-1/2 top-2 -translate-x-1/2",
              left: "left-2 top-1/2 -translate-y-1/2",
              right: "right-2 top-1/2 -translate-y-1/2 mr-0"
            };
            return opponents.slice(0, 3).map((opp: string, i: number) => (
              <div key={opp} className={"absolute z-30 " + pos[slots[i]]}>
                <Seat
                  seed={opp}
                  name={nameOf(opp)}
                  count={state.hands[opp]?.length || 0}
                  isTurn={state.turn === opp && state.status === "playing"}
                  wins={Number(game.ranks?.[opp] ?? 0)}
                  bubble={bubbles[opp]}
                />
              </div>
            ));
          })()}

          {/* Centre of the table */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={pickFromMarket}
                disabled={!isMyTurn || isProcessing}
                className={"relative flex flex-col items-center transition-transform " + (isMyTurn ? "active:scale-95" : "opacity-60")}
              >
                <WhotBack />
                <span className="absolute -bottom-5 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                  Market ({state.deck.length})
                </span>
              </button>

              <div className="relative h-24 w-16">
                {state.discard.slice(-2).map((c, i, arr) => (
                  <div key={c.id} className="absolute inset-0" style={{ transform: "rotate(" + (i === arr.length - 1 ? 0 : -8) + "deg)" }}>
                    <div className="flex h-full w-full flex-col justify-between rounded-lg border border-black/20 bg-[#fdfbf7] p-1.5 text-[#8B3A35] shadow-2xl">
                      <div className="text-sm font-bold leading-none">{c.value}</div>
                      <div className="flex scale-75 justify-center">
                        {c.suit === "whot" ? <span className="text-sm font-black">WHOT</span> : <SuitIcon suit={c.suit} />}
                      </div>
                      <div className="self-end rotate-180 text-sm font-bold leading-none">{c.value}</div>
                    </div>
                  </div>
                ))}
                {state.calledSuit ? (
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                    Play: {state.calledSuit}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Status line */}
          <div className="absolute inset-x-0 bottom-[7.5rem] z-20 flex justify-center px-3">
            <span className={"rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest " + (isMyTurn ? "animate-pulse bg-amber-400 text-black" : "bg-black/50 text-white/70")}>
              {isMyTurn ? "Your turn" : lastAction}
            </span>
          </div>

          {/* My seat */}
          <div className="absolute inset-x-0 bottom-0 z-40">
            <div className="flex items-end justify-between px-3">
              <div className="relative flex items-center gap-2">
                <div className={"rounded-full ring-4 " + (isMyTurn ? "ring-amber-400" : rankOf(wins).ring)}>
                  <Alama seed={mySeed || sessionId} size={40} />
                </div>
                <div className="leading-tight">
                  <div className="max-w-[110px] truncate text-sm font-bold text-amber-50">{myHandle}</div>
                  <span className={"rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide " + rankOf(wins).chip}>
                    {rankOf(wins).icon} {rankOf(wins).name} · {wins}W {losses}L
                  </span>
                </div>
                {bubbles[sessionId] ? (
                  <div className="absolute bottom-full left-6 mb-1 w-max max-w-[150px] rounded-xl bg-white px-2 py-1 text-[11px] font-bold leading-tight text-black shadow-lg">
                    {bubbles[sessionId]}
                  </div>
                ) : null}
              </div>
              <VoiceToggle />
            </div>

            <div className="relative mx-auto mt-1 h-28 w-full max-w-md">
              {myHand.map((card, index) => {
                const n = myHand.length;
                const mid = (n - 1) / 2;
                const spread = Math.min(34, 280 / Math.max(n, 1));
                const rot = (index - mid) * Math.min(6, 40 / Math.max(n, 1));
                const dy = Math.pow(Math.abs(index - mid), 2) * 1.4;
                const playable = isMyTurn && canPlayCard(card, topCard, state.calledSuit, state.activePenalty, state.penaltyType);
                const lift = selectedCard?.id === card.id ? -26 : playable ? -12 : 0;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleCardClick(card)}
                    aria-label={getCardName(card)}
                    className={"absolute bottom-0 left-1/2 -ml-8 origin-bottom transition-transform duration-200 " + (isMyTurn && !playable ? "opacity-60 saturate-50" : "")}
                    style={{
                      transform: "translateX(" + (index - mid) * spread + "px) translateY(" + (dy + lift) + "px) rotate(" + rot + "deg)",
                      zIndex: index
                    }}
                  >
                    <div className={"flex h-24 w-16 flex-col justify-between rounded-lg border bg-[#fdfbf7] p-1.5 text-[#8B3A35] shadow-xl " + (playable ? "border-amber-400" : "border-black/20")}>
                      <div className="text-left text-sm font-bold leading-none">{card.value}</div>
                      <div className="flex scale-75 justify-center">
                        {card.suit === "whot" ? <span className="text-sm font-black">WHOT</span> : <SuitIcon suit={card.suit} />}
                      </div>
                      <div className="self-end rotate-180 text-sm font-bold leading-none">{card.value}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Suit picker */}
      {suitPickerOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 rounded-2xl border border-amber-700/50 bg-[#2A1B12] p-5 text-center shadow-2xl">
            <h3 className="mb-3 text-lg font-bold text-amber-100">Pick a Suit</h3>
            <div className="flex gap-3">
              {(["circle", "triangle", "cross", "star", "square"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuitPick(s)}
                  aria-label={s}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white transition-transform hover:border-amber-500 active:scale-90"
                >
                  <div className="scale-75"><SuitIcon suit={s} /></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game over + invite funnel */}
      {state.status === "finished" && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <div className="mb-3 text-6xl">{state.winner === sessionId ? "🏆" : "😔"}</div>
          <h2 className="text-3xl font-black text-white">
            {state.winner === sessionId ? "You won!" : nameOf(state.winner || "") + " won!"}
          </h2>
          <p className="mt-2 text-sm text-white/60">Enjoyed it? Bring your people to the table.</p>
          <PostGameActions onQuit={onQuit} canInvite={!game.dm_thread_id} />
        </div>
      )}
    </div>
  ))(computeBubbles(state, game.players, topCard));
}