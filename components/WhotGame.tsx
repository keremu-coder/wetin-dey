"use client";

import { useState, useEffect, useRef } from "react";
import {
  WhotCard,
  WhotSuit,
  WhotState,
  canPlayCard,
  getNextTurn,
  startWhotGame,
  shuffleDeck
} from "@/lib/whot";
import { getBotMove, BotAction } from "@/lib/whot-bot";
import { playProfile, unlockAudio, vibrate } from "@/lib/sounds";
import { shareUrl } from "@/lib/share";
import { Alama } from "./Alama";

// GLOBAL AUDIO INSTANCE (Stops chat audio from overlapping and fixes volume)
let voiceAudio: HTMLAudioElement | null = null;

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

type CardSize = "lg" | "md" | "sm" | "xs";

const SIZES: Record<CardSize, {
  w: number; h: number; corner: number; icon: number; pip: number;
  backW: number; backH: number; backFont: number; avatar: number;
}> = {
  lg: { w: 56, h: 84, corner: 14, icon: 30, pip: 12, backW: 24, backH: 34, backFont: 9, avatar: 28 },
  md: { w: 46, h: 69, corner: 12, icon: 24, pip: 10, backW: 20, backH: 28, backFont: 8, avatar: 24 },
  sm: { w: 38, h: 57, corner: 10, icon: 20, pip: 9, backW: 16, backH: 23, backFont: 7, avatar: 20 },
  xs: { w: 30, h: 45, corner: 9, icon: 16, pip: 8, backW: 14, backH: 20, backFont: 6, avatar: 16 }
};

const MAT_STYLE: React.CSSProperties = {
  backgroundColor: "#2b130d",
  backgroundImage: [
    "repeating-linear-gradient(45deg, rgba(196,87,47,0.16) 0px, rgba(196,87,47,0.16) 2px, transparent 2px, transparent 14px)",
    "repeating-linear-gradient(-45deg, rgba(217,164,65,0.10) 0px, rgba(217,164,65,0.10) 2px, transparent 2px, transparent 14px)"
  ].join(", ")
};

const KENTE_STYLE: React.CSSProperties = {
  background:
    "repeating-linear-gradient(90deg, #c4572f 0px, #c4572f 14px, #d9a441 14px, #d9a441 22px, #2b2f6b 22px, #2b2f6b 36px, #d9a441 36px, #d9a441 44px)"
};

const RANKS: { name: string; min: number }[] = [
  { name: "Rookie", min: 0 },
  { name: "Trader", min: 5 },
  { name: "Oga", min: 15 },
  { name: "Chairman", min: 30 },
  { name: "Igwe", min: 60 }
];

function getRank(wins: number): { name: string; next: { name: string; need: number } | null } {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (wins >= RANKS[i].min) idx = i;
  }
  const nxt = idx + 1 < RANKS.length ? RANKS[idx + 1] : null;
  return {
    name: RANKS[idx].name,
    next: nxt ? { name: nxt.name, need: nxt.min - wins } : null
  };
}

type VoiceMode = "male" | "female" | "off";
const VOICE_KEY = "whot_voice";

function playCustomSound(text: string, mode: VoiceMode) {
  if (mode === "off") return;

  let file = "";
  if (text.includes("pick 2")) file = "pick2";
  else if (text.includes("market my guy")) file = "market";
  else if (text.includes("Hold on")) file = "holdon";
  else if (text.includes("Suspension")) file = "suspense";
  else if (text.includes("Last card")) file = "lastcard";
  else if (text.includes("win")) file = "win";
  else if (text.includes("done go market")) file = "idongo";

  if (file) {
    // REUSE A SINGLE AUDIO INSTANCE TO PREVENT OVERLAPPING & ENSURE VOLUME
    if (!voiceAudio) {
      voiceAudio = new Audio();
    }
    voiceAudio.src = `/sounds/${mode}/${file}.mp3`;
    voiceAudio.volume = 1.0;
    voiceAudio.play().catch((err) => {
      console.log("Audio playback failed. Ensure files are pushed and user tapped screen.", err);
    });
  }
}

const ALL_SUITS: WhotSuit[] = ["circle", "triangle", "cross", "square", "star"];

function bestSuitFor(hand: WhotCard[]): WhotSuit {
  const counts: Record<WhotSuit, number> = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0 };
  for (const c of hand) {
    if (c.suit !== "whot") counts[c.suit]++;
  }
  let best: WhotSuit = "circle";
  let max = -1;
  for (const s of ALL_SUITS) {
    if (counts[s] > max) {
      max = counts[s];
      best = s;
    }
  }
  return best;
}

function stateSignature(s: WhotState | null | undefined): string {
  if (!s || !s.hands || !s.discard) return "";
  const counts = Object.keys(s.hands)
    .sort()
    .map((id) => id + ":" + (s.hands[id]?.length ?? 0))
    .join(",");
  const top = s.discard[s.discard.length - 1];
  return [
    s.status,
    s.turn,
    s.discard.length,
    top ? top.id : "-",
    s.deck ? s.deck.length : 0,
    counts,
    s.activePenalty,
    s.penaltyType ?? "-",
    s.calledSuit ?? "-",
    s.winner ?? "-"
  ].join("|");
}

function drawCards(
  deck: WhotCard[],
  discard: WhotCard[],
  count: number
): { drawn: WhotCard[]; deck: WhotCard[]; discard: WhotCard[] } {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const drawn: WhotCard[] = [];
  while (drawn.length < count) {
    if (nextDeck.length === 0) {
      if (nextDiscard.length <= 1) break;
      const top = nextDiscard[nextDiscard.length - 1];
      nextDeck = shuffleDeck(nextDiscard.slice(0, -1));
      nextDiscard = [top];
    }
    const c = nextDeck.shift();
    if (!c) break;
    drawn.push(c);
  }
  return { drawn, deck: nextDeck, discard: nextDiscard };
}

function resolvePlay(
  state: WhotState,
  players: string[],
  actorId: string,
  card: WhotCard,
  calledSuit: WhotSuit | null,
  youId: string,
  nameOf: (id: string) => string
): { next: WhotState; text: string } {
  const who = (id: string): string => (id === youId ? "You" : nameOf(id));
  const hand = (state.hands[actorId] || []).filter((c) => c.id !== card.id);
  const hands: Record<string, WhotCard[]> = { ...state.hands, [actorId]: hand };
  let discard = [...state.discard, card];
  let deck = [...state.deck];
  let nextTurn = getNextTurn(players, actorId);
  let text = `${who(actorId)} played ${getCardName(card)}`;
  let activePenalty = 0;
  let penaltyType: "2" | "5" | null = null;

  if (card.value === 2) {
    activePenalty = (state.penaltyType === "2" ? state.activePenalty : 0) + 2;
    penaltyType = "2";
    text += ` (Pick ${activePenalty} stacked)`;
  } else if (card.value === 8) {
    const skipped = getNextTurn(players, actorId);
    nextTurn = getNextTurn(players, actorId, 2);
    text += `. ${who(skipped)} ${skipped === youId ? "are" : "is"} suspended!`;
  } else if (card.value === 14) {
    for (const p of players) {
      if (p === actorId) continue;
      const d = drawCards(deck, discard, 1);
      deck = d.deck;
      discard = d.discard;
      hands[p] = [...(hands[p] || []), ...d.drawn];
    }
    nextTurn = actorId;
    text += ". General Market: everyone else picks 1!";
  } else if (card.value === 1) {
    nextTurn = actorId;
    text += ". Hold on!";
  }

  const finished = hand.length === 0;
  const next: WhotState = {
    ...state,
    hands,
    discard,
    deck,
    turn: nextTurn,
    calledSuit: card.value === 20 ? calledSuit : null,
    winner: finished ? actorId : null,
    status: finished ? "finished" : "playing",
    activePenalty,
    penaltyType
  };
  return { next, text };
}

function resolvePick(
  state: WhotState,
  players: string[],
  actorId: string
): { next: WhotState; drawnCount: number } {
  const amount = state.activePenalty > 0 ? state.activePenalty : 1;
  const d = drawCards(state.deck, state.discard, amount);
  const next: WhotState = {
    ...state,
    deck: d.deck,
    discard: d.discard,
    hands: { ...state.hands, [actorId]: [...(state.hands[actorId] || []), ...d.drawn] },
    turn: getNextTurn(players, actorId),
    activePenalty: 0,
    penaltyType: null
  };
  return { next, drawnCount: d.drawn.length };
}

function normalizeBotMove(
  move: BotAction,
  hand: WhotCard[],
  activePenalty: number,
  penaltyType: "2" | "5" | null
): BotAction {
  if (!move || move.action !== "play") return move;
  let card = move.card;
  if (activePenalty > 0 && penaltyType && card.value === 20) {
    const stack = hand.find((c) => c.value === Number(penaltyType));
    if (stack) card = stack;
  }
  if (card.value === 20) {
    const chosen = card;
    return {
      action: "play",
      card: chosen,
      calledSuit: move.calledSuit ?? bestSuitFor(hand.filter((c) => c.id !== chosen.id))
    };
  }
  return { action: "play", card };
}

function CardFace({ card, size, style }: { card: WhotCard; size: CardSize; style?: React.CSSProperties }) {
  const sz = SIZES[size];
  const isWhot = card.value === 20;
  const ink = isWhot ? "#2b2f6b" : "#8B3A2B";
  return (
    <div
      role="img"
      aria-label={getCardName(card)}
      className="relative shrink-0 select-none overflow-hidden rounded-md border border-[#e4d5b8] bg-[#FBF4E6] shadow-md"
      style={{ width: sz.w, height: sz.h, color: ink, ...style }}
    >
      <div className="absolute left-1 top-0.5 flex flex-col items-center leading-none">
        <span className="font-bold" style={{ fontSize: sz.corner }}>{card.value}</span>
        <span className="mt-0.5 block" style={{ width: sz.pip, height: sz.pip }}><SuitIcon suit={card.suit} /></span>
      </div>
      <div className="flex h-full w-full items-center justify-center">
        {isWhot ? (
          <span className="font-black leading-none tracking-tighter" style={{ fontSize: Math.round(sz.icon * 0.42) }}>WHOT</span>
        ) : (
          <span className="block" style={{ width: sz.icon, height: sz.icon }}><SuitIcon suit={card.suit} /></span>
        )}
      </div>
      <div className="absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center leading-none">
        <span className="font-bold" style={{ fontSize: sz.corner }}>{card.value}</span>
        <span className="mt-0.5 block" style={{ width: sz.pip, height: sz.pip }}><SuitIcon suit={card.suit} /></span>
      </div>
    </div>
  );
}

// --- AUTHENTIC WHOT CARD BACK SVG ---
function AuthenticWhotBack({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] shadow-sm"
      style={{ width: w, height: h, backgroundColor: "#7A1010" }} // Deep Authentic Red
    >
      <svg viewBox="0 0 100 150" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* White Border Frame */}
        <rect x="2" y="2" width="96" height="146" rx="4" stroke="#FBF4E6" strokeWidth="2" strokeOpacity="0.8" />
        
        {/* WHOT Logo Text (Curved style imitation) */}
        <g fill="#FBF4E6">
          {/* Swirl on W */}
          <path d="M 20 65 Q 15 65 15 70 Q 15 75 20 75 Q 25 75 25 70 Q 25 60 20 55" stroke="#FBF4E6" strokeWidth="2" fill="none" />
          
          {/* W */}
          <path d="M 28 55 L 33 75 L 38 60 L 43 75 L 48 55" stroke="#FBF4E6" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          
          {/* h */}
          <path d="M 52 50 L 52 75 M 52 62 Q 57 55 62 62 L 62 75" stroke="#FBF4E6" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          {/* Swirl on h */}
          <path d="M 62 60 Q 67 60 67 65 Q 67 70 62 70" stroke="#FBF4E6" strokeWidth="2" fill="none" />
          
          {/* o (with accent) */}
          <circle cx="75" cy="68" r="6" stroke="#FBF4E6" strokeWidth="4" />
          <path d="M 72 58 L 78 58" stroke="#FBF4E6" strokeWidth="2" strokeLinecap="round" />
          
          {/* t */}
          <path d="M 85 55 L 85 75 M 82 60 L 88 60" stroke="#FBF4E6" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

function VoiceToggle({ mode, onChange }: { mode: VoiceMode; onChange: (m: VoiceMode) => void }) {
  const opts: { id: VoiceMode; label: string; aria: string }[] = [
    { id: "male", label: "♂", aria: "Male voice" },
    { id: "female", label: "♀", aria: "Female voice" },
    { id: "off", label: "🔇", aria: "Voice off" }
  ];
  return (
    <div role="group" aria-label="Voice reactions" className="flex shrink-0 rounded-full bg-black/40 p-0.5">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-label={o.aria}
          aria-pressed={mode === o.id}
          onClick={() => onChange(o.id)}
          className={`h-6 min-w-[24px] rounded-full px-1.5 text-xs font-bold transition-colors ${
            mode === o.id ? "bg-[#d9a441] text-[#3b1a12]" : "text-white/70"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Snap = { discardLen: number; turn: string; status: string; lastHolders: string[] };

export function WhotGame({ game, isPlayer, sessionId, onQuit, mySeed }: { game: any, isPlayer: boolean, sessionId: string, onQuit: () => void, mySeed?: string }) {
  const state: WhotState = game.game_state;
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WhotCard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Game started");

  const handles: Record<string, string> = game.handles ?? {};
  const nameOf = (id: string): string =>
    id === "bot" ? "🤖 Bot" : handles[id] ? "@" + handles[id] : "Player " + ((game.players ?? []).indexOf(id) + 1);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  const declaredRef = useRef(false);
  const [hasDeclaredLastCard, setHasDeclaredLastCard] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);

  const [dragState, setDragState] = useState<{ id: string, x: number, y: number } | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const pressedCardRef = useRef<WhotCard | null>(null);

  const [sentSig, setSentSig] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("male");
  const [inviteNote, setInviteNote] = useState("");
  const [notice, setNotice] = useState("");
  const noticeTimerRef = useRef<number | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const tryPlayRef = useRef<(card: WhotCard) => void>(() => {});
  const scoreInitRef = useRef(false);
  const scoredKeyRef = useRef("");
  const prevSnapRef = useRef<Snap | null>(null);

  const topCard = state?.discard[state.discard.length - 1];
  const isMyTurn = state?.turn === sessionId;
  const isBotTurn = state?.turn === "bot";

  const stateSig = stateSignature(state);
  const iAmSeated = Array.isArray(game.players) && game.players.includes(sessionId);
  const isWaiting = sentSig !== "" && sentSig === stateSig;
  const canAct = isMyTurn && state?.status === "playing" && !isProcessing && !isWaiting;
  const hasState = !!(state && state.hands);

  function wake() {
    unlockAudio();
    // Play a silent blip to unlock audio context on iOS
    if (!voiceAudio) {
      voiceAudio = new Audio();
      voiceAudio.volume = 0;
      voiceAudio.play().catch(() => {});
    }
  }

  function speak(text: string) {
    if (!iAmSeated || voiceMode === "off") return;
    playCustomSound(text, voiceMode);
  }

  function chooseVoice(mode: VoiceMode) {
    wake();
    setVoiceMode(mode);
    try { localStorage.setItem(VOICE_KEY, mode); } catch { }
  }

  function flash(text: string) {
    setNotice(text);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2800);
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    unlockAudio();
    setWins(Number(localStorage.getItem("whot_wins") || 0));
    setLosses(Number(localStorage.getItem("whot_losses") || 0));
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(VOICE_KEY); } catch { }
    if (saved === "male" || saved === "female" || saved === "off") {
      setVoiceMode(saved);
    }
  }, []);

  useEffect(() => {
    if (!hasState) return;
    const host = rootRef.current ? rootRef.current.parentElement : null;
    if (!host) return;
    const measure = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      setBox((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(host);
    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [hasState]);

  useEffect(() => {
    if (!state) return;
    const key = game.id + ":" + state.discard.length + ":" + String(state.winner);
    if (!scoreInitRef.current) {
      scoreInitRef.current = true;
      if (state.status === "finished") {
        scoredKeyRef.current = key;
        return;
      }
    }
    if (state.status !== "finished") {
      scoredKeyRef.current = "";
      return;
    }
    if (!iAmSeated || scoredKeyRef.current === key) return;
    scoredKeyRef.current = key;
    if (state.winner === sessionId) {
      const newWins = wins + 1;
      setWins(newWins);
      localStorage.setItem("whot_wins", String(newWins));
    } else if (state.winner === "bot" || (state.winner && state.winner !== sessionId)) {
      const newLosses = losses + 1;
      setLosses(newLosses);
      localStorage.setItem("whot_losses", String(newLosses));
    }
  }, [state?.status, state?.winner, sessionId]);

  useEffect(() => {
    if (isMyTurn && state?.status === "playing") {
      playProfile("bbm", "mention");
      vibrate([100, 50, 100]);
    }
  }, [isMyTurn, state?.status]);

  useEffect(() => {
    if (!state || !state.discard || !state.hands) return;
    const holders = Object.keys(state.hands)
      .filter((id) => (state.hands[id]?.length ?? 0) === 1)
      .sort();
    const next: Snap = {
      discardLen: state.discard.length,
      turn: state.turn,
      status: state.status,
      lastHolders: holders
    };
    const prev = prevSnapRef.current;
    prevSnapRef.current = next;
    if (!prev) return;

    if (state.status === "finished" && prev.status !== "finished") {
      if (state.winner === sessionId) speak("I done win!");
      else speak("Dem don win me");
      return;
    }
    if (state.status !== "playing") return;

    const lines: string[] = [];
    if (next.discardLen > prev.discardLen) {
      const top = state.discard[state.discard.length - 1];
      const actor = prev.turn;
      if (actor !== sessionId && actor !== "bot") {
        setLastAction(nameOf(actor) + " played " + getCardName(top));
      }
      if (top.value === 2) lines.push("Oya take pick 2!");
      else if (top.value === 14) lines.push("Go market my guy!");
      else if (top.value === 1) lines.push("Hold on o!");
      else if (top.value === 8) lines.push("Suspension! Sit down small.");
    }
    if (holders.some((id) => !prev.lastHolders.includes(id))) {
      lines.push("Last card, check up!");
    }
    if (lines.length > 0) speak(lines.join(" "));
  }, [stateSig]);

  useEffect(() => {
    if (!isBotTurn || isProcessing || state?.status === "finished") return;
    if (sentSig !== "" && sentSig === stateSig) return;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      try {
        const players: string[] = game.players;
        const botHand: WhotCard[] = state.hands["bot"] || [];
        const opponentCounts = players.filter((p: string) => p !== "bot").map((p: string) => state.hands[p]?.length || 0);
        const raw = getBotMove(botHand, topCard, state.calledSuit, state.activePenalty, state.penaltyType, opponentCounts);
        const move = normalizeBotMove(raw, botHand, state.activePenalty, state.penaltyType);

        if (move && move.action === "pick") {
          const { next, drawnCount } = resolvePick(state, players, "bot");
          setLastAction(`🤖 Bot picked ${drawnCount} card(s).`);
          playProfile("bbm", "receive");
          await pushState(next);
        } else if (move && move.action === "play") {
          const { next, text } = resolvePlay(state, players, "bot", move.card, move.calledSuit ?? null, sessionId, nameOf);
          setLastAction(text);
          playProfile("bbm", "receive");
          await pushState(next);
        }
      } finally {
        setIsProcessing(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [isBotTurn, state, topCard, isProcessing, game.id, game.players, sentSig, stateSig]);

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
        tryPlayRef.current(card);
        return;
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isOverDiscard = el?.closest('#discard-pile');
      if (isOverDiscard) {
        tryPlayRef.current(card);
      }
    }

    function onPointerCancel() {
      pressedCardRef.current = null;
      dragStartPos.current = { x: 0, y: 0 };
      isDraggingRef.current = false;
      setDragState(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [state?.hands, sessionId, state?.calledSuit, state?.activePenalty, state?.penaltyType]);

  function handlePointerDown(e: React.PointerEvent, card: WhotCard) {
    wake();
    if (!canAct) return;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    pressedCardRef.current = card;
  }

  async function pushState(next: WhotState): Promise<boolean> {
    setSentSig(stateSignature(state));
    try {
      const res = await fetch("/api/space-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_state", gameId: game.id, game_state: next })
      });
      if (!res.ok) {
        setSentSig("");
        flash("Move did not send. Check your connection.");
        return false;
      }
      return true;
    } catch {
      setSentSig("");
      flash("Move did not send. Check your connection.");
      return false;
    }
  }

  function tryPlayCard(card: WhotCard) {
    if (!canAct || suitPickerOpen || showQuitModal) return;
    if (!canPlayCard(card, topCard, state.calledSuit, state.activePenalty, state.penaltyType)) {
      vibrate([50, 50]);
      flash(
        state.activePenalty > 0
          ? `Play a ${state.penaltyType} to stack, or pick ${state.activePenalty}`
          : "That card does not match"
      );
      return;
    }
    if (card.value === 20) {
      setSelectedCard(card);
      setSuitPickerOpen(true);
    } else {
      void playCard(card);
    }
  }

  async function playCard(card: WhotCard, calledSuit: WhotSuit | null = null) {
    if (!canAct) return;
    wake();

    if ((state.hands[sessionId] || []).length === 2 && !declaredRef.current) {
      setIsProcessing(true);
      const draw = drawCards(state.deck, state.discard, 1);
      const penaltyState: WhotState = {
        ...state,
        deck: draw.deck,
        discard: draw.discard,
        hands: { ...state.hands, [sessionId]: [...(state.hands[sessionId] || []), ...draw.drawn] },
        turn: state.activePenalty > 0 ? sessionId : getNextTurn(game.players, sessionId)
      };
      setSuitPickerOpen(false);
      setSelectedCard(null);
      setLastAction("You forgot to call LAST CARD. Penalty: pick 1.");
      flash("You forgot to call LAST CARD. Penalty: pick 1.");
      vibrate([80, 40, 80]);
      await pushState(penaltyState);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    const { next, text } = resolvePlay(state, game.players, sessionId, card, calledSuit, sessionId, nameOf);

    setLastAction(text);
    playProfile("bbm", "send");
    vibrate(30);
    declaredRef.current = false;
    setHasDeclaredLastCard(false);
    setSuitPickerOpen(false);
    setSelectedCard(null);

    await pushState(next);
    setIsProcessing(false);
  }

  async function pickFromMarket() {
    if (!canAct) return;
    wake();
    speak("I done go market!"); 
    setIsProcessing(true);

    const { next, drawnCount } = resolvePick(state, game.players, sessionId);

    setLastAction(`You picked ${drawnCount} card(s).`);
    playProfile("bbm", "send");

    declaredRef.current = false;
    setHasDeclaredLastCard(false);

    await pushState(next);
    setIsProcessing(false);
  }

  async function playAgain() {
    if (!iAmSeated || isProcessing || isWaiting) return;
    wake();
    setIsProcessing(true);
    const fresh = startWhotGame(game.players, state.useAnyplay);
    declaredRef.current = false;
    setHasDeclaredLastCard(false);
    setSuitPickerOpen(false);
    setSelectedCard(null);
    setShowQuitModal(false);
    setLastAction("New game started");
    const ok = await pushState(fresh);
    if (ok) playProfile("bbm", "mention");
    setIsProcessing(false);
  }

  async function inviteFriends() {
    wake();
    const origin = window.location.origin;
    const url = game.dm_thread_id ? origin : origin + window.location.pathname + "?play=1";
    const res = await shareUrl({
      url,
      title: "Whot on Wetin Dey",
      text: "Come play Whot with me on Wetin Dey"
    });
    if (res.ok && res.method === "clipboard") setInviteNote("Link copied!");
    else if (!res.ok && res.reason === "error") setInviteNote("Could not share. Copy the link from your browser.");
    else return;
    window.setTimeout(() => setInviteNote(""), 2500);
  }

  tryPlayRef.current = tryPlayCard;

  if (!state || !state.hands) return <div className="text-center text-muted p-4">Dealing cards...</div>;

  const myHand = state.hands[sessionId] || [];

  const isSemiLast = myHand.length === 2;
  const isLast = myHand.length === 1;

  const myHandle = nameOf(sessionId);
  const rank = getRank(wins);

  const myIdx = game.players.indexOf(sessionId);
  const ordered: string[] = myIdx < 0
    ? [...game.players]
    : [...game.players.slice(myIdx + 1), ...game.players.slice(0, myIdx)];
  const opponents = ordered.filter((p) => p !== sessionId).slice(0, 3);

  const tier: CardSize = box.h === 0 ? "lg" : box.h >= 500 ? "lg" : box.h >= 400 ? "md" : box.h >= 320 ? "sm" : "xs";
  const sz = SIZES[tier];

  const hn = myHand.length;
  const cw = sz.w;
  const angleStep = hn > 1 ? Math.min(4, 24 / (hn - 1)) : 0;
  const maxAngle = (angleStep * (hn - 1)) / 2;
  const sidePad = Math.ceil(sz.h * Math.sin((maxAngle * Math.PI) / 180)) + 4;
  const availW = Math.max(cw, (box.w > 0 ? box.w : 320) - 16 - sidePad * 2);
  const idealStep = cw * 0.72;
  const fitStep = hn > 1 ? (availW - cw) / (hn - 1) : idealStep;
  const step = hn > 1 ? Math.max(14, Math.min(idealStep, fitStep)) : 0;
  const fanWidth = hn > 0 ? cw + step * (hn - 1) : 0;

  let bannerText: string;
  let bannerClass: string;
  if (state.status === "finished") {
    bannerText = state.winner === sessionId ? "You won" : nameOf(state.winner || "") + " won";
    bannerClass = "bg-black/40 text-white";
  } else if (notice) {
    bannerText = notice;
    bannerClass = "bg-red-700/80 text-white";
  } else if (isMyTurn) {
    bannerText = state.activePenalty > 0
      ? `Your turn. Pick ${state.activePenalty}: stack a ${state.penaltyType} or pick`
      : isLast ? "Your turn. Play your last card" : "Your turn";
    bannerClass = "bg-[#d9a441] text-[#2b130d]";
  } else {
    bannerText = "Last action: " + lastAction;
    bannerClass = "bg-black/35 text-white/80";
  }

  const iWon = state.winner === sessionId;

  return (
    <>
    <div
      ref={rootRef}
      className="flex w-full max-w-full shrink-0 select-none flex-col overflow-hidden rounded-xl text-white" // FIXED HEIGHT FOR CHAT SPACE
      style={MAT_STYLE}
    >
      <div className="h-1.5 w-full shrink-0" style={KENTE_STYLE} />

      {/* Opponents Row */}
      <div className="flex shrink-0 gap-1.5 px-2 pt-1 pb-2">
        {opponents.map((id) => {
          const count = state.hands[id]?.length || 0;
          const turn = state.turn === id && state.status === "playing";
          const shown = Math.min(count, 7);
          return (
            <div
              key={id}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 ${turn ? "bg-[#d9a441]/20 ring-1 ring-[#d9a441]" : "bg-black/25"}`}
            >
              <div className="flex w-full min-w-0 items-center justify-center gap-1">
                {tier !== "xs" ? <Alama seed={id} size={sz.avatar} /> : null}
                <span className={`min-w-0 truncate text-[11px] font-bold ${turn ? "text-[#f0c36a]" : "text-white/80"}`}>{nameOf(id)}</span>
                <span className="shrink-0 rounded-full bg-black/45 px-1.5 text-[10px] font-semibold tabular-nums leading-4 text-white/80">{count}</span>
              </div>
              <div className="flex w-full items-center justify-center overflow-hidden" style={{ height: sz.backH }}>
                {Array.from({ length: shown }).map((_, i) => (
                  <div key={i} style={{ marginLeft: i === 0 ? 0 : -Math.round(sz.backW * 0.55) }}>
                    <AuthenticWhotBack w={sz.backW} h={sz.backH} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Section */}
      <div className="flex flex-1 flex-col justify-center relative min-h-[100px]">
        <div className="flex shrink-0 items-center justify-center gap-2 px-2 py-1">
          <div
            role="status"
            aria-live="polite"
            title={bannerText}
            className={`min-w-0 max-w-full truncate rounded-full px-3 py-1 text-[12px] font-semibold ${bannerClass}`}
          >
            {bannerText}
          </div>
          {isSemiLast && canAct ? (
            <button
              type="button"
              onClick={() => { wake(); setHasDeclaredLastCard(true); declaredRef.current = true; playProfile("bbm", "mention"); }}
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold text-white ${hasDeclaredLastCard ? "bg-green-700" : "bg-red-600 motion-safe:animate-pulse"}`}
            >
              {hasDeclaredLastCard ? "✓ Last card called" : "Say last card"}
            </button>
          ) : null}
        </div>

        {state.status === "finished" ? (
          <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 overflow-y-auto px-4 py-2 text-center">
            <h2 className="text-xl font-black">{iWon ? "🏆 You won!" : "😔 " + nameOf(state.winner || "") + " won!"}</h2>
            <p className="text-xs text-white/75">
              Rank: <span className="font-bold text-[#f0c36a]">{rank.name}</span>
              {rank.next
                ? ` (${rank.next.need} more ${rank.next.need === 1 ? "win" : "wins"} to ${rank.next.name})`
                : " (top rank)"}
              {" · "}{wins}W {losses}L
            </p>
            <div className="flex w-full max-w-sm flex-wrap justify-center gap-2">
              {iAmSeated ? (
                <button
                  type="button"
                  onClick={() => void playAgain()}
                  disabled={isProcessing || isWaiting}
                  className="min-w-[120px] flex-1 rounded-xl bg-[#c4572f] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60"
                >
                  {isProcessing || isWaiting ? "Dealing…" : "Play again"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void inviteFriends()}
                className="min-w-[120px] flex-1 rounded-xl border border-[#d9a441]/70 bg-black/30 px-4 py-2.5 text-sm font-bold text-[#f0c36a] transition-transform active:scale-95"
              >
                Invite friends to play
              </button>
            </div>
            {inviteNote ? <p role="status" className="text-xs text-green-300">{inviteNote}</p> : null}
            <button type="button" onClick={onQuit} className="text-xs font-semibold text-white/60 underline underline-offset-2 hover:text-white">
              Exit to lobby
            </button>
          </div>
        ) : showQuitModal ? (
          <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-base font-bold">Quit Game?</p>
            <p className="text-xs text-white/70">Are you sure you want to leave? Your progress will be lost.</p>
            <div className="flex w-full max-w-xs gap-2">
              <button type="button" onClick={() => setShowQuitModal(false)} className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-semibold text-white">Cancel</button>
              <button type="button" onClick={onQuit} className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white">Quit</button>
            </div>
          </div>
        ) : (
          <>
            {suitPickerOpen ? (
              <div className="flex min-h-[84px] flex-1 flex-col items-center justify-center gap-2 px-2 py-1">
                <p className="text-sm font-bold">Call a suit</p>
                <div className="flex w-full max-w-sm gap-1.5">
                  {ALL_SUITS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { wake(); if (selectedCard) void playCard(selectedCard, s); }}
                      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg bg-[#FBF4E6] px-1 py-1.5 text-[#8B3A2B] transition-transform active:scale-95"
                    >
                      <span className="block h-6 w-6"><SuitIcon suit={s} /></span>
                      <span className="text-[9px] font-bold capitalize">{s}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { setSuitPickerOpen(false); setSelectedCard(null); }} className="text-xs font-bold text-red-300">Cancel</button>
              </div>
            ) : (
              <div className="flex min-h-[84px] flex-1 items-center justify-center gap-6 px-3 py-1">
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void pickFromMarket()}
                    disabled={!canAct}
                    aria-label={state.activePenalty > 0 ? `Pick ${state.activePenalty} cards from the market` : "Pick a card from the market"}
                    className={`rounded-md transition-transform active:scale-95 disabled:opacity-60 ${state.activePenalty > 0 ? "ring-2 ring-red-500 motion-safe:animate-pulse" : ""}`}
                  >
                    <AuthenticWhotBack w={sz.w} h={sz.h} />
                  </button>
                  <span className="rounded-full bg-black/40 px-2 text-[10px] font-semibold leading-4 text-white/85">
                    {state.activePenalty > 0 ? `Pick ${state.activePenalty}` : `${state.deck.length} in market`}
                  </span>
                </div>

                <div id="discard-pile" className="flex flex-col items-center gap-1">
                  <CardFace card={topCard} size={tier} />
                  <span className={`rounded-full bg-black/40 px-2 text-[10px] font-semibold capitalize leading-4 text-[#f0c36a] ${state.calledSuit ? "" : "invisible"}`}>
                    {state.calledSuit ? "Play " + state.calledSuit : "-"}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Section (Profile, Voice, Quit, Hand) */}
      <div className="shrink-0 bg-black/30 pt-1 pb-1 px-2 border-t border-[#5c3a21] relative z-20">
        <div className="flex items-center justify-between px-1 mb-1">
          <div className="flex items-center gap-1.5">
            <Alama seed={mySeed || sessionId} size={24} />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white leading-none">{iAmSeated ? myHandle : "Watching"}</span>
              <span className="text-[9px] text-[#f0c36a] leading-tight mt-0.5">{rank.name} · {wins}W {losses}L</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VoiceToggle mode={voiceMode} onChange={chooseVoice} />
            <button
              type="button"
              aria-label="Quit game"
              onClick={() => { wake(); setShowQuitModal(true); }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow transition-colors hover:bg-red-500 active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Fanned Hand */}
        <div className="shrink-0 overflow-x-auto overflow-y-hidden" style={{ touchAction: "pan-x" }}>
          <div
            className="mx-auto flex items-end"
            style={{
              width: fanWidth + sidePad * 2,
              paddingLeft: sidePad,
              paddingRight: sidePad,
              paddingTop: 12,
              paddingBottom: 6,
              height: sz.h + 30
            }}
          >
            {myHand.map((card, i) => {
              const isDragging = dragState?.id === card.id;
              const mid = (hn - 1) / 2;
              const rot = (i - mid) * angleStep;
              const drop = Math.min(10, (i - mid) * (i - mid) * 0.35);
              return (
                <div
                  key={card.id}
                  onPointerDown={(e) => handlePointerDown(e, card)}
                  className={`cursor-pointer transition-transform ${isDragging ? "opacity-30" : ""}`}
                  style={{
                    flex: "none",
                    width: sz.w,
                    height: sz.h,
                    marginLeft: i === 0 ? 0 : step - cw,
                    transform: `translateY(${drop}px) rotate(${rot}deg)`,
                    transformOrigin: "50% 100%"
                  }}
                >
                  <CardFace card={card} size={tier} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>

    {dragState && (() => {
      const card = myHand.find(c => c.id === dragState.id);
      if (!card) return null;
      return (
        <div className="fixed pointer-events-none z-[100]" style={{ left: dragState.x - 32, top: dragState.y - 48 }}>
          <CardFace card={card} size="lg" />
        </div>
      );
    })()}
    </>
  );
}
