"use client";

import { useEffect, useRef, useState } from "react";
import { playProfile, unlockAudio, vibrate } from "@/lib/sounds";
import { WhotCard, WhotSuit, canPlayCard, WhotState, getNext, startWhotGame } from "@/lib/whot";
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
  if (card.value === 20) return "WHOT 20";
  if (card.value === 1) return "HOLD ON";
  if (card.value === 2) return "PICK 2";
  if (card.value === 8) return card.suit === "star" ? "STAR" : "GENERAL MARKET";
  if (card.value === 14) return "GENERAL MARKET";
  return `${card.value} ${card.suit.toUpperCase()}`;
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
  const opponents = ordered.filter((p) => p !== sessionId);

  const myHand = state.hands[sessionId] || [];
  const topCard = state.discard[state.discard.length - 1];
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
      const move = getBotMove(state, "bot");
      let newState = { ...state };
      
      if (move.action === "draw") {
        const newDeck = [...state.deck];
        const drawn = newDeck.splice(0, 1);
        const newHand = [...(state.hands["bot"] || []), ...drawn];
        newState = {
          ...state,
          deck: newDeck,
          hands: { ...state.hands, ["bot"]: newHand },
          turn: getNext(state.players, "bot"),
        };
        setLastAction(`🤖 Bot picked a card.`);
      } else {
        const newHand = (state.hands["bot"] || []).filter(c => c.id !== move.card.id);
        newState = {
          ...state,
          hands: { ...state.hands, ["bot"]: newHand },
          discard: [...state.discard, move.card],
          turn: getNext(state.players, "bot"),
          calledSuit: move.calledSuit || null,
          winner: newHand.length === 0 ? "bot" : null,
          status: newHand.length === 0 ? "finished" : "playing",
        };
        setLastAction(`🤖 Bot played ${getCardName(move.card)}`);
      }
      
      playProfile("bbm", "receive");
      await syncState(newState);
      setIsProcessing(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isBotTurn, state, isProcessing]);

  function handleCardClick(card: WhotCard) {
    if (!isMyTurn || isProcessing) return;
    if (!canPlayCard(card, topCard, state.calledSuit, state.activePenalty)) return;
    
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
    const newState: WhotState = {
      ...state,
      hands: { ...state.hands, [sessionId]: newHand },
      discard: [...state.discard, card],
      turn: getNext(state.players, sessionId),
      calledSuit: suit,
      winner: newHand.length === 0 ? sessionId : null,
      status: newHand.length === 0 ? "finished" : "playing",
    };
    setLastAction(`You played ${getCardName(card)}`);
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
    if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);
    
    const drawAmount = state.activePenalty > 0 ? state.activePenalty : 1;
    const drawn = newDeck.splice(0, drawAmount);
    newHand.push(...drawn);
    
    const newState = {
      ...state,
      deck: newDeck,
      hands: { ...state.hands, [sessionId]: newHand },
      turn: getNext(state.players, sessionId),
      activePenalty: 0,
      penaltyType: null,
    };
    setLastAction(`You picked ${drawAmount} card(s).`);
    playProfile("bbm", "send");
    await syncState(newState);
    setIsProcessing(false);
  }

  if (!state || !state.hands) return <div className="text-center text-white p-4">Dealing cards...</div>;

  return (
    <div className="w-full h-full flex flex-col bg-[#120A07] relative overflow-hidden select-none">
      
      {/* Subtle table felt/gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#2A1B12] via-[#120A07] to-[#0a0502] opacity-80" />

      {/* Top Bar: Score */}
      <div className="absolute top-0 inset-x-0 z-40 flex justify-between items-center text-white/90 p-3">
        <div className="flex items-center gap-2">
          <Alama seed={mySeed || sessionId} size={36} />
          <div>
            <span className="font-bold text-sm text-white">{myHandle}</span>
            <div className="text-[10px] text-white/60">{myHand.length} cards left</div>
          </div>
        </div>
        <div className="flex flex-col items-center bg-black/50 px-4 py-1.5 rounded-xl border border-amber-900/50">
          <span className="text-[0.65rem] text-amber-500 uppercase tracking-widest">Score</span>
          <div className="flex gap-4 font-mono font-bold text-sm">
            <span className="text-green-500">{wins}W</span>
            <span className="text-red-500">{losses}L</span>
          </div>
        </div>
      </div>

      {/* --- OPPONENT SEATS --- */}
      {opponents[0] && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className={"relative flex flex-col items-center transition-all duration-300 " + (state.turn === opponents[0] ? 'scale-110' : 'scale-95 opacity-70')}>
            <div className={"absolute inset-0 rounded-full blur-md -z-10 " + (state.turn === opponents[0] ? 'bg-amber-500/40' : 'bg-transparent')} />
            <Alama seed={opponents[0]} size={48} className={state.turn === opponents[0] ? 'ring-4 ring-amber-500 rounded-full' : 'ring-2 ring-white/10 rounded-full'} />
            <span className={"mt-2 text-xs font-bold px-3 py-1 rounded-full " + (state.turn === opponents[0] ? 'bg-amber-500 text-black' : 'bg-black/60 text-white/70')}>
              {nameOf(opponents[0])}
            </span>
            <div className="flex -space-x-4 mt-2">
              {Array.from({ length: Math.min(state.hands[opponents[0]]?.length || 0, 6) }).map((_, i) => (
                <div key={i} className="w-8 h-12 rounded-md bg-[#8B3A35] border border-black/50 shadow-md" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- CENTER TABLE (Market & Discard) --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-10 z-20">
        {/* Draw Deck */}
        <button onClick={pickFromMarket} disabled={!isMyTurn || isProcessing} className={"relative group transition-all " + (!isMyTurn ? 'opacity-50' : 'hover:-translate-y-2')}>
          <div className="w-20 h-32 rounded-xl bg-[#8B3A35] border-2 border-[#A3423D] shadow-[0_10px_20px_rgba(0,0,0,0.6)] flex items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
             <span className="text-white/40 font-bold transform -rotate-45 tracking-widest text-xl">WHOT</span>
          </div>
          <span className="absolute -bottom-8 inset-x-0 text-center text-xs text-amber-500 font-bold uppercase">Market</span>
        </button>

        {/* Discard Pile */}
        <div className="relative w-24 h-36">
          {state.discard.slice(-3).map((c, i, arr) => (
            <div key={c.id} className="absolute inset-0 transition-all duration-300" style={{ transform: "rotate(" + ((c.id.length % 10) - 5) + "deg)" }}>
              <div className={`w-full h-full rounded-xl bg-white shadow-${i === arr.length - 1 ? '[0_10px_25px_rgba(0,0,0,0.8)]' : 'lg'} border border-black/10 flex flex-col justify-between p-2 text-[#8B3A35]`}>
                <div className="text-[1.2rem] font-bold">{c.value}</div>
                <div className="text-center flex justify-center"><SuitIcon suit={c.suit} /></div>
                <div className="text-[1.2rem] font-bold self-end rotate-180">{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MY HAND (Fanned) --- */}
      <div className="absolute bottom-0 inset-x-0 z-40 h-48 flex items-end justify-center pb-4">
        <div className="relative flex justify-center w-full max-w-lg px-4">
          {myHand.map((card, index) => {
            const isSelected = selectedCard?.id === card.id;
            const mid = (myHand.length - 1) / 2;
            const rotate = (index - mid) * 6; 
            const translateY = Math.abs(index - mid) * 8;
            
            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(card)}
                className={"absolute origin-bottom transition-all duration-200 cursor-pointer " + (isSelected ? '-translate-y-12 z-50' : 'hover:-translate-y-8 hover:z-50')}
                style={{
                  transform: "translateX(" + (index - mid) * 45 + "px) rotate(" + rotate + "deg) translateY(" + translateY + "px)",
                  zIndex: index
                }}
              >
                <div className="w-20 h-32 sm:w-24 sm:h-36 rounded-xl bg-white shadow-lg border border-black/10 flex flex-col justify-between p-2 text-[#8B3A35]">
                  <div className="text-[1.2rem] font-bold">{card.value}</div>
                  <div className="text-center flex justify-center"><SuitIcon suit={card.suit} /></div>
                  <div className="text-[1.2rem] font-bold self-end rotate-180">{card.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- TURN INDICATOR --- */}
      {state.turn === sessionId && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-20 z-50 pointer-events-none">
          <span className="bg-amber-500 text-black text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-bounce block">
            Your Turn
          </span>
        </div>
      )}

      {/* Suit Picker Modal */}
      {suitPickerOpen && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#2A1B12] p-6 rounded-3xl text-center border border-amber-700/50 shadow-2xl">
            <h3 className="text-amber-100 text-xl font-bold mb-4">Pick a Suit</h3>
            <div className="flex gap-4">
              {(["circle", "triangle", "cross", "star", "square"] as const).map((s) => (
                <button key={s} onClick={() => handleSuitPick(s)} className="w-14 h-14 rounded-full bg-black/40 border border-white/10 hover:border-amber-500 hover:bg-amber-900/40 flex items-center justify-center transition-transform active:scale-90 text-white">
                  <SuitIcon suit={s} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
