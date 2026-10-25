"use client";

import { useState, useEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { WhotCard, WhotSuit, canPlayCard, WhotState, getNextTurn } from "@/lib/whot";
import { getBotMove } from "@/lib/whot-bot";
import { playProfile, unlockAudio, vibrate } from "@/lib/sounds";
import { Alama } from "./Alama";

const SvgBall = () => <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><circle cx="12" cy="12" r="10"/></svg>;
const SvgAngle = () => <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><polygon points="12,2 23,22 1,22"/></svg>;
const SvgCross = () => <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z"/></svg>;
const SvgCarpet = () => <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><rect x="2" y="2" width="20" height="20"/></svg>;
const SvgStar = () => <svg viewBox="0 0 24 24" className="w-full h-full fill-current"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/></svg>;

function SuitIcon({ suit }: { suit: string }) {
  if (suit === "circle") return <SvgBall />;
  if (suit === "triangle") return <SvgAngle />;
  if (suit === "cross") return <SvgCross />;
  if (suit === "square") return <SvgCarpet />;
  if (suit === "star") return <SvgStar />;
  return null;
}

function getCardName(card: WhotCard): string {
  if (card.value === 20) return "WHOT 20";
  if (card.value === 1) return "HOLD ON";
  if (card.value === 2) return "PICK 2";
  if (card.value === 8) return card.suit === "star" ? "STAR 8" : "SUSPENSION";
  if (card.value === 14) return "GENERAL MARKET";
  return `${card.value} ${card.suit.toUpperCase()}`;
}

const DRAG_THRESHOLD = 10;


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
    <button type="button" aria-label={aria} aria-pressed={pref === v} onClick={() => setPref(v)} className={"h-7 min-w-7 px-2 text-xs font-bold " + (pref === v ? "bg-amber-500 text-black" : "bg-black/40 text-amber-100/70")}>
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
    <div className="pointer-events-none absolute left-1/2 -top-8 z-50 w-max max-w-[130px] -translate-x-1/2 rounded-xl bg-white px-2 py-1 text-center text-[10px] font-bold leading-tight text-black shadow-lg">
      <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white" />
      {text}
    </div>
  );
}

function WhotBack({ small }: { small?: boolean }) {
  return (
    <div className={"relative flex shrink-0 items-center justify-center overflow-hidden rounded border-2 border-[#d9a35b] bg-[#8B3A35] shadow-sm " + (small ? "h-8 w-5" : "h-16 w-12")}>
      <span className={"-rotate-45 font-black tracking-widest text-[#f5d9a8] " + (small ? "text-[6px]" : "text-[10px]")}>WHOT</span>
    </div>
  );
}

function Seat({ name, count, isTurn, wins, bubble, seed }: { name: string; count: number; isTurn: boolean; wins: number; bubble?: string; seed: string }) {
  const rank = rankOf(wins);
  return (
    <div className={"relative flex flex-col items-center transition-all duration-300 " + (isTurn ? "scale-105" : "opacity-75")}>
      <div className={"rounded-full ring-2 " + (isTurn ? "ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : rank.ring)}>
        <Alama seed={seed} size={28} />
      </div>
      <span className={"mt-1 max-w-[60px] truncate rounded-full px-1.5 py-0.5 text-[8px] font-bold " + (isTurn ? "bg-amber-400 text-black" : "bg-black/60 text-white/80")}>{name}</span>
      <span className={"mt-0.5 rounded-full px-1.5 py-0.5 text-[6px] font-extrabold uppercase tracking-wide " + rank.chip}>{rank.icon} {rank.name}</span>
      <div className="mt-1 flex -space-x-2">
        {Array.from({ length: Math.min(count, 3) }).map((_, i) => <WhotBack key={i} small />)}
        {count > 3 ? <span className="pl-3 text-[8px] font-bold text-white/80">+{count - 3}</span> : null}
      </div>
      {bubble && <Bubble text={bubble} />}
    </div>
  );
}

export function WhotGame({ game, isPlayer, sessionId, onQuit, mySeed }: { game: any, isPlayer: boolean, sessionId: string, onQuit: () => void, mySeed?: string }) {
  const supabase = getBrowserClient();
  const state: WhotState = game.game_state;
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WhotCard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Game started");
  
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  
  const declaredRef = useRef(false);
  const [hasDeclaredLastCard, setHasDeclaredLastCard] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);

  const [dragState, setDragState] = useState<{ id: string, x: number, y: number } | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const pressedCardRef = useRef<WhotCard | null>(null);

  const topCard = state?.discard[state.discard.length - 1];
  const isMyTurn = state?.turn === sessionId;
  const isBotTurn = state?.turn === "bot";

  useEffect(() => {
    unlockAudio();
    setWins(Number(localStorage.getItem("whot_wins") || 0));
    setLosses(Number(localStorage.getItem("whot_losses") || 0));
  }, []);

  // Fetch real handles for all players
  useEffect(() => {
    const fetchHandles = async () => {
      const ids = game.players.filter((p: string) => p !== "bot");
      if (ids.length === 0) return;
      const { data } = await supabase.from("sessions").select("id, handle").in("id", ids);
      if (data) {
        const map: Record<string, string> = {};
        for (const p of data) map[p.id] = p.handle;
        setHandles(map);
      }
    };
    fetchHandles();
  }, [game.players]);

  // Save Score
  useEffect(() => {
    if (state?.status === "finished") {
      if (state.winner === sessionId) {
        const newWins = wins + 1;
        setWins(newWins);
        localStorage.setItem("whot_wins", String(newWins));
      } else if (state.winner === "bot" || (state.winner && state.winner !== sessionId)) {
        const newLosses = losses + 1;
        setLosses(newLosses);
        localStorage.setItem("whot_losses", String(newLosses));
      }
    }
  }, [state?.status, state?.winner, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isMyTurn && state?.status === "playing") {
      playProfile("bbm", "mention");
      vibrate([100, 50, 100]);
    }
  }, [isMyTurn, state?.status]);

  useEffect(() => {
    if (!isBotTurn || isProcessing || state.status === "finished") return;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      const opponentCounts = game.players.filter((p: string) => p !== "bot").map((p: string) => state.hands[p]?.length || 0);
      const move = getBotMove(state.hands["bot"] || [], topCard, state.calledSuit, state.activePenalty, state.penaltyType, opponentCounts);

      if (move && move.action === "pick") {
        let newDeck = [...state.deck];
        let newHand = [...(state.hands["bot"] || [])];
        if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);
        
        const drawAmount = state.activePenalty > 0 ? state.activePenalty : 1;
        const drawn = newDeck.splice(0, drawAmount);
        newHand.push(...drawn);
        
        const newState: WhotState = {
          ...state,
          deck: newDeck,
          hands: { ...state.hands, ["bot"]: newHand },
          turn: getNextTurn(game.players, "bot"),
          activePenalty: 0,
          penaltyType: null
        };

        setLastAction(`🤖 Bot picked ${drawAmount} card(s).`);
        playProfile("bbm", "receive");
        await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_state", gameId: game.id, game_state: newState })
      });
      } 
      else if (move && move.action === "play") {
        const newHand = (state.hands["bot"] || []).filter(c => c.id !== move.card.id);
        const newHands: Record<string, WhotCard[]> = { ...state.hands, ["bot"]: newHand };
        const newDiscard = [...state.discard, move.card];

        let nextTurn = getNextTurn(game.players, "bot");
        let newDeck = [...state.deck];
        let nextHands: Record<string, WhotCard[]> = { ...newHands };
        let actionText = `🤖 Bot played ${getCardName(move.card)}`;
        
        let activePenalty = state.activePenalty;
        let penaltyType = state.penaltyType;

        if (move.card.value === 2) {
          activePenalty = (state.penaltyType === "2" ? state.activePenalty : 0) + 2;
          penaltyType = "2";
          actionText += ` (Stack: ${activePenalty})`;
          nextTurn = getNextTurn(game.players, "bot");
        } else if (move.card.value === 8) {
          if (move.card.suit === "star") {
            nextTurn = getNextTurn(game.players, "bot", 2);
            actionText += ". Next 2 players suspended!";
          } else {
            nextTurn = getNextTurn(game.players, "bot", 2);
            actionText += ". You are suspended!";
          }
          activePenalty = 0; penaltyType = null;
        } else if (move.card.value === 14) {
          for (const p of game.players) {
            if (p !== "bot") nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
          }
          actionText += ". You pick 1!";
          nextTurn = "bot"; // Bot continues
          activePenalty = 0; penaltyType = null;
        } else if (move.card.value === 1) {
          nextTurn = "bot";
          actionText += ". Bot holds on.";
          activePenalty = 0; penaltyType = null;
        } else {
          activePenalty = 0; penaltyType = null;
        }

        const newState: WhotState = {
          ...state,
          hands: nextHands,
          discard: newDiscard,
          deck: newDeck,
          turn: nextTurn,
          calledSuit: move.calledSuit || null,
          winner: newHand.length === 0 ? "bot" : null,
          status: newHand.length === 0 ? "finished" : "playing",
          activePenalty,
          penaltyType
        };

        setLastAction(actionText);
        playProfile("bbm", "receive");
        await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_state", gameId: game.id, game_state: newState })
      });
      }
      setIsProcessing(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isBotTurn, state, topCard, isProcessing, game.id, game.players]);

  // Global Pointer Handlers
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!pressedCardRef.current) return;
      
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      if (!isDraggingRef.current) {
        if (Math.abs(dx) > Math.abs(dy) + 5) {
          pressedCardRef.current = null;
          dragStartPos.current = { x: 0, y: 0 };
          return;
        }
        if (dy < -10) {
          isDraggingRef.current = true;
          setDragState({ id: pressedCardRef.current.id, x: e.clientX, y: e.clientY });
        }
      }

      if (isDraggingRef.current) {
        setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
      }
    }

    function onPointerUp(e: PointerEvent) {
      const card = pressedCardRef.current;
      if (!card) return;
      
      const wasDragging = isDraggingRef.current;
      
      pressedCardRef.current = null;
      dragStartPos.current = { x: 0, y: 0 };
      isDraggingRef.current = false;
      setDragState(null);

      if (!wasDragging) {
        tryPlayCard(card);
        return;
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isOverDiscard = el?.closest('#discard-pile');
      if (isOverDiscard) {
        tryPlayCard(card);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [state.hands, sessionId, state.calledSuit, state.activePenalty, state.penaltyType]);

  function handlePointerDown(e: React.PointerEvent, card: WhotCard) {
    if (!isMyTurn || isProcessing) return;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    pressedCardRef.current = card;
  }

  function tryPlayCard(card: WhotCard) {
    if (!canPlayCard(card, topCard, state.calledSuit, state.activePenalty, state.penaltyType)) {
      vibrate([50, 50]);
      return;
    }
    if (card.value === 20) {
      setSelectedCard(card);
      setSuitPickerOpen(true);
    } else {
      playCard(card);
    }
  }

  async function playCard(card: WhotCard, calledSuit: WhotSuit | null = null) {
    // Last Card Rule Check (using the ref to avoid stale state)
    if ((state.hands[sessionId] || []).length === 2 && !declaredRef.current) {
      alert("⚠️ You didn't call LAST CARD! You must draw 1 penalty card.");
      const newDeck = [...state.deck];
      const drawn = newDeck.splice(0, 1);
      const newHand = [...(state.hands[sessionId] || []), ...drawn];
      const newState = {
        ...state,
        deck: newDeck,
        hands: { ...state.hands, [sessionId]: newHand },
        turn: getNextTurn(game.players, sessionId)
      };
      await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_state", gameId: game.id, game_state: newState })
      });
      return;
    }

    setIsProcessing(true);
    
    const newHand = (state.hands[sessionId] || []).filter(c => c.id !== card.id);
    const newHands: Record<string, WhotCard[]> = { ...state.hands, [sessionId]: newHand };
    const newDiscard = [...state.discard, card];

    let nextTurn = getNextTurn(game.players, sessionId);
    let newDeck = [...state.deck];
    let nextHands: Record<string, WhotCard[]> = { ...newHands };
    let actionText = `You played ${getCardName(card)}`;
    
    let activePenalty = state.activePenalty;
    let penaltyType = state.penaltyType;

    if (card.value === 2) {
      activePenalty = (state.penaltyType === "2" ? state.activePenalty : 0) + 2;
      penaltyType = "2";
      actionText += ` (Stack: ${activePenalty})`;
      nextTurn = getNextTurn(game.players, sessionId);
    } else if (card.value === 8) {
      if (card.suit === "star") {
        nextTurn = getNextTurn(game.players, sessionId, 2);
        actionText += ". Next 2 players suspended!";
      } else {
        nextTurn = getNextTurn(game.players, sessionId, 2);
        actionText += ". Bot suspended!";
      }
      activePenalty = 0; penaltyType = null;
    } else if (card.value === 14) {
      for (const p of game.players) {
        if (p !== sessionId) nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
      }
      actionText += ". Bot picks 1!";
      nextTurn = sessionId; // You continue
      activePenalty = 0; penaltyType = null;
    } else if (card.value === 1) {
      nextTurn = sessionId;
      actionText += ". You hold on.";
      activePenalty = 0; penaltyType = null;
    } else {
      activePenalty = 0; penaltyType = null;
    }

    const newState: WhotState = {
      ...state,
      hands: nextHands,
      discard: newDiscard,
      deck: newDeck,
      turn: nextTurn,
      calledSuit: calledSuit,
      winner: newHand.length === 0 ? sessionId : null,
      status: newHand.length === 0 ? "finished" : "playing",
      activePenalty,
      penaltyType
    };

    setLastAction(actionText);
    playProfile("bbm", "send");
    vibrate(30);

    await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_state", gameId: game.id, game_state: newState })
      });
    
    setSuitPickerOpen(false);
    setSelectedCard(null);
    setIsProcessing(false);
  }

  async function pickFromMarket() {
    if (!isMyTurn || isProcessing) return;
    setIsProcessing(true);
    
    let newDeck = [...state.deck];
    let newHand = [...(state.hands[sessionId] || [])];
    
    if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);

    const drawAmount = state.activePenalty > 0 ? state.activePenalty : 1;
    const drawn = newDeck.splice(0, drawAmount);
    newHand.push(...drawn);
    
    const newState: WhotState = {
      ...state,
      deck: newDeck,
      hands: { ...state.hands, [sessionId]: newHand },
      turn: getNextTurn(game.players, sessionId), // Turn passes to the player who played the penalty
      activePenalty: 0,
      penaltyType: null
    };

    setLastAction(`You picked ${drawAmount} card(s).`);
    playProfile("bbm", "send");
    
    // Reset Last Card declaration because hand size increased
    declaredRef.current = false;
    setHasDeclaredLastCard(false);

    await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_state", gameId: game.id, game_state: newState })
      });
    
    setIsProcessing(false);
  }

  if (!state || !state.hands) return <div className="text-center text-muted p-4">Dealing cards...</div>;

  const myHand = state.hands[sessionId] || [];
  const botHandCount = state.hands["bot"]?.length || 0;
  
  const isSemiLast = myHand.length === 2;
  const isLast = myHand.length === 1;

  const CardUI = ({ card, isDragging, style }: any) => {
    const isWhot = card.value === 20;
    return (
      <div
        style={{ ...style }}
        className={`relative flex flex-col justify-between items-center bg-[#FDFBF7] rounded-md overflow-hidden select-none shadow-md border-2 border-gray-200 w-16 h-24 shrink-0 transition-transform`}
      >
        <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none text-[#8B3A2B]">
          <span className="text-[0.9rem] font-bold">{card.value}</span>
          <div className="w-3 h-3 mt-0.5"><SuitIcon suit={card.suit} /></div>
        </div>
        <div className="flex-1 flex items-center justify-center w-full px-2">
           {isWhot ? (
             <span className="text-[#8B3A2B] font-black text-lg tracking-tighter text-center leading-none">WHOT</span>
           ) : (
             <div className="w-10 h-10 text-[#8B3A2B]">
               <SuitIcon suit={card.suit} />
             </div>
           )}
        </div>
        <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none text-[#8B3A2B] rotate-180">
          <span className="text-[0.9rem] font-bold">{card.value}</span>
          <div className="w-3 h-3 mt-0.5"><SuitIcon suit={card.suit} /></div>
        </div>
      </div>
    );
  };

  const CardBack = () => (
    <div className="w-5 h-7 bg-[#8B3A2B] border border-[#5A2217] rounded-[2px] shadow-sm shrink-0" />
  );

  const opponentId = game.players.find((p: string) => p !== sessionId) || "bot";
  const isOpponentBot = opponentId === "bot";
  const opponentHandle = isOpponentBot ? "🤖 Bot" : `@${handles[opponentId] || "Player"}`;
  const myHandle = `@${handles[sessionId] || "You"}`;

  return (
    <div className="w-full h-full flex flex-col bg-[#0a2e16] rounded-xl overflow-hidden relative select-none">
      
      {/* Top Bar / Opponents */}
      <div className="flex justify-between items-center text-white/90 text-xs p-2 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Alama seed={opponentId} size={32} />
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0a2e16] ${state.turn === opponentId ? 'bg-yellow-500' : 'bg-gray-500'}`} />
          </div>
          <div>
            <span className={`px-2 py-1 rounded font-bold ${state.turn === opponentId ? 'text-yellow-500' : 'text-white/70'}`}>
              {opponentHandle}
            </span>
            <div className="flex -space-x-2 mt-1">
              {Array.from({ length: Math.min(botHandCount, 8) }).map((_, i) => (
                <CardBack key={i} />
              ))}
              {botHandCount > 8 && (
                <div className="w-5 h-7 bg-black/50 rounded flex items-center justify-center text-[10px] font-bold z-10 -ml-1 border border-white/20">
                  +{botHandCount - 8}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="flex flex-col items-center bg-black/30 px-3 py-1 rounded-lg border border-white/10">
          <span className="text-[0.6rem] text-white/50 uppercase tracking-widest mb-0.5">Score</span>
          <div className="flex gap-3 font-mono font-bold">
            <span className="text-green-400">{wins}W</span>
            <span className="text-red-400">{losses}L</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`px-2 py-1 rounded font-bold ${state.turn === sessionId ? 'text-yellow-500' : 'text-white/70'}`}>
              {myHandle}
            </span>
            <div className="text-[10px] text-white/50">{myHand.length} cards</div>
          </div>
          <div className="relative">
            <Alama seed={mySeed || sessionId} size={32} />
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0a2e16] ${state.turn === sessionId ? 'bg-yellow-500' : 'bg-gray-500'}`} />
          </div>
        </div>
      </div>

      {/* Game Log / Alert Banner */}
      <div className={`text-center py-2 text-xs font-bold shrink-0 transition-colors flex items-center justify-center gap-2 ${isMyTurn ? 'bg-yellow-500 text-black' : 'bg-black/20 text-white/70'}`}>
        {isSemiLast && isMyTurn ? (
          <button onClick={() => { setHasDeclaredLastCard(true); declaredRef.current = true; playProfile("bbm", "mention"); }} className={`px-3 py-1 rounded ${hasDeclaredLastCard ? 'bg-green-600 text-white' : 'bg-red-600 text-white animate-pulse'}`}>
            {hasDeclaredLastCard ? "✓ Last Card Declared" : "⚠️ TAP TO SAY LAST CARD"}
          </button>
        ) :
         isLast && isMyTurn ? "🚨 PLAY YOUR LAST CARD!" :
         isMyTurn ? (
          state.activePenalty > 0 ? `⚠️ PICK ${state.activePenalty}! Play a ${state.penaltyType} or pick.` : "⚡ YOUR TURN!"
        ) : (
          lastAction
        )}
      </div>

      {/* Center Table */}
      <div className="flex-1 flex items-center justify-center gap-6 relative">
        <button 
          onClick={pickFromMarket}
          disabled={!isMyTurn || isProcessing}
          className={`relative w-16 h-24 bg-[#8B3A2B] rounded-md shadow-lg border-2 border-[#5A2217] flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition-transform ${state.activePenalty > 0 ? 'ring-4 ring-red-500 animate-pulse' : ''}`}
        >
          <span className="text-[10px] font-bold rotate-[-15deg] text-white/40 uppercase tracking-widest">Whot</span>
          <div className="absolute -bottom-5 text-white text-[10px] font-semibold bg-black/50 px-2 py-0.5 rounded-full whitespace-nowrap">
            {state.deck.length} left
          </div>
        </button>

        <div id="discard-pile" className="relative p-2">
           <CardUI card={topCard} />
           {state.calledSuit && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[0.6rem] text-yellow-300 font-bold whitespace-nowrap bg-black/60 px-2 py-1 rounded-full uppercase">
              Play: {state.calledSuit}
            </div>
          )}
        </div>

        {/* Quit Button */}
        <button 
          onClick={() => setShowQuitModal(true)} 
          className="absolute right-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* My Hand */}
      <div className="h-32 bg-black/40 p-2 flex gap-2 overflow-x-auto items-center shrink-0" style={{ touchAction: 'pan-x' }}>
        {myHand.map((card) => {
          const isPlayable = isMyTurn && canPlayCard(card, topCard, state.calledSuit, state.activePenalty, state.penaltyType);
          const isDragging = dragState?.id === card.id;
          return (
            <div 
              key={card.id} 
              onPointerDown={(e) => handlePointerDown(e, card)}
              className={`shrink-0 cursor-pointer ${isDragging ? 'opacity-30' : ''} ${isPlayable ? 'hover:-translate-y-2 transition-transform' : ''}`}
            >
              <CardUI card={card} />
            </div>
          );
        })}
      </div>

      {/* Dragged Card Render (Fixed to Pointer) */}
      {dragState && (() => {
        const card = myHand.find(c => c.id === dragState.id);
        if (!card) return null;
        return ((bubbles: Record<string, string>) => (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden bg-[#1a0f0a]">
      <VoiceReactions bubbles={bubbles} />

      <div className="m-1 flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-[#5c3a21] bg-[#2A1B12] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)] relative">
        
        <div className="flex items-center justify-between px-2 py-1.5 bg-black/40 border-b border-[#5c3a21] shrink-0">
          <div className="flex items-center gap-1.5">
            <Alama seed={mySeed || sessionId} size={28} />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-amber-50">{myHandle}</span>
              <span className="text-[8px] text-amber-200/60">{myHand.length} cards left</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
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

        <div className="flex justify-center gap-3 px-2 py-2 shrink-0">
          {opponents.slice(0, 3).map((opp: string) => (
            <Seat key={opp} seed={opp} name={nameOf(opp)} count={state.hands[opp]?.length || 0} isTurn={state.turn === opp && state.status === "playing"} wins={Number(game.ranks?.[opp] ?? 0)} bubble={bubbles[opp]} />
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
          {isMyTurn && (
            <div className="absolute top-0 z-10 animate-bounce">
              <span className="bg-amber-500 text-black text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)] border border-amber-300">
                Your Turn
              </span>
            </div>
          )}

          <div className="flex items-center gap-4 mt-2">
            <button onClick={pickFromMarket} disabled={!isMyTurn || isProcessing} className={"flex flex-col items-center transition-transform " + (isMyTurn ? "active:scale-95" : "opacity-60")}>
              <WhotBack />
              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-300 bg-black/50 px-1.5 py-0.5 rounded-full">Market ({state.deck.length})</span>
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
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">Play: {state.calledSuit}</div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 bg-black/30 pt-1 pb-1 px-2 border-t border-[#5c3a21] relative z-20">
          
          <div className="flex items-center justify-between px-1 mb-1">
            <span className={"rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-widest " + (isMyTurn ? "bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-black/50 text-white/70")}>
              {isMyTurn ? "Your turn" : lastAction}
            </span>
            <VoiceToggle />
          </div>

          <div className="relative mx-auto h-24 w-full max-w-sm flex items-end justify-center pb-1">
            {myHand.map((card, index) => {
              const n = myHand.length;
              const mid = (n - 1) / 2;
              const spread = Math.min(28, 220 / Math.max(n, 1));
              const rot = (index - mid) * Math.min(6, 40 / Math.max(n, 1));
              const dy = Math.pow(Math.abs(index - mid), 2) * 1.1;
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
          {bubbles[sessionId] && <Bubble text={bubbles[sessionId]} />}
        </div>

      </div>

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

      {state.status === "finished" && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/95 p-6 text-center backdrop-blur-md">
          <div className="mb-2 text-5xl">{state.winner === sessionId ? "🏆" : "😔"}</div>
          <h2 className="text-2xl font-black text-white">{state.winner === sessionId ? "You won!" : nameOf(state.winner || "") + " won!"}</h2>
          
          <div className="mt-6 flex w-full max-w-[240px] flex-col gap-2">
            <button 
              type="button" 
              onClick={() => {
                const newGameState = startWhotGame(game.players, true);
                setState(newGameState);
                syncState(newGameState);
              }} 
              className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-black active:scale-95 shadow-lg shadow-amber-500/20"
            >
              Play Again
            </button>
            <button type="button" onClick={onQuit} className="rounded-xl border border-white/30 px-4 py-3 text-sm font-bold text-white active:scale-95">Back to lobby</button>
          </div>
        </div>
      )}
    </div>
  ))(computeBubbles(state, game.players, topCard));
}
