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
  if (card.value === 5) return "PICK 3";
  if (card.value === 8) return card.suit === "star" ? "STAR 8" : "SUSPENSION";
  if (card.value === 14) return "GENERAL MARKET";
  return `${card.value} ${card.suit.toUpperCase()}`;
}

const DRAG_THRESHOLD = 10;

export function WhotGame({ game, isPlayer, sessionId, onQuit, mySeed }: { game: any, isPlayer: boolean, sessionId: string, onQuit: () => void, mySeed?: string }) {
  const supabase = getBrowserClient();
  const state: WhotState = game.game_state;
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WhotCard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Game started");
  
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [hasDeclaredLastCard, setHasDeclaredLastCard] = useState(false);

  const [dragState, setDragState] = useState<{ id: string, x: number, y: number } | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const topCard = state?.discard[state.discard.length - 1];
  const isMyTurn = state?.turn === sessionId;
  const isBotTurn = state?.turn === "bot";

  useEffect(() => {
    unlockAudio();
    setWins(Number(localStorage.getItem("whot_wins") || 0));
    setLosses(Number(localStorage.getItem("whot_losses") || 0));
  }, []);

  // Save Score
  useEffect(() => {
    if (state?.status === "finished") {
      if (state.winner === sessionId) {
        const newWins = wins + 1;
        setWins(newWins);
        localStorage.setItem("whot_wins", String(newWins));
      } else if (state.winner === "bot") {
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
      const move = getBotMove(state.hands["bot"] || [], topCard, state.calledSuit, opponentCounts);

      if (move && move.action === "pick") {
        let newDeck = [...state.deck];
        let newHand = [...(state.hands["bot"] || [])];
        if (newDeck.length === 0) newDeck = [...state.discard.slice(0, -1)].sort(() => Math.random() - 0.5);
        
        const drawn = newDeck.splice(0, 1);
        newHand.push(...drawn);
        
        const newState: WhotState = {
          ...state,
          deck: newDeck,
          hands: { ...state.hands, ["bot"]: newHand },
          turn: getNextTurn(game.players, "bot")
        };

        setLastAction(`🤖 Bot picked 1 card.`);
        playProfile("bbm", "receive");
        await supabase.from("space_games").update({ game_state: newState }).eq("id", game.id);
      } 
      else if (move && move.action === "play") {
        const newHand = (state.hands["bot"] || []).filter(c => c.id !== move.card.id);
        const newHands: Record<string, WhotCard[]> = { ...state.hands, ["bot"]: newHand };
        const newDiscard = [...state.discard, move.card];

        let nextTurn = getNextTurn(game.players, "bot");
        let newDeck = [...state.deck];
        let nextHands: Record<string, WhotCard[]> = { ...newHands };
        let actionText = `🤖 Bot played ${getCardName(move.card)}`;

        if (move.card.value === 2) {
          nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 2)];
          nextTurn = getNextTurn(game.players, nextTurn);
          actionText += ". You pick 2!";
        } else if (move.card.value === 5) {
          nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 3)];
          nextTurn = getNextTurn(game.players, nextTurn);
          actionText += ". You pick 3!";
        } else if (move.card.value === 8) {
          if (move.card.suit === "star") {
            nextTurn = getNextTurn(game.players, nextTurn, 2);
            actionText += ". Skip 2!";
          } else {
            nextTurn = getNextTurn(game.players, nextTurn);
            actionText += ". You skip!";
          }
        } else if (move.card.value === 14) {
          for (const p of game.players) {
            if (p !== "bot") nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
          }
          actionText += ". You pick 1!";
        } else if (move.card.value === 1) {
          nextTurn = "bot";
          actionText += ". Continue.";
        }

        const newState: WhotState = {
          ...state,
          hands: nextHands,
          discard: newDiscard,
          deck: newDeck,
          turn: nextTurn,
          calledSuit: move.calledSuit || null,
          winner: newHand.length === 0 ? "bot" : null,
          status: newHand.length === 0 ? "finished" : "playing"
        };

        setLastAction(actionText);
        playProfile("bbm", "receive");
        await supabase.from("space_games").update({ game_state: newState }).eq("id", game.id);
      }
      setIsProcessing(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isBotTurn, state, topCard, isProcessing, game.id, game.players]);

  // Global Pointer Handlers
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragState) return;
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
      }
      setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragState) return;
      const wasDragging = isDraggingRef.current;
      const cardId = dragState.id;
      setDragState(null);
      isDraggingRef.current = false;

      const card = (state.hands[sessionId] || []).find(c => c.id === cardId);
      if (!card) return;

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
  }, [dragState, state.hands, sessionId]);

  function handlePointerDown(e: React.PointerEvent, card: WhotCard) {
    if (!isMyTurn || isProcessing) return;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    setDragState({ id: card.id, x: e.clientX, y: e.clientY });
  }

  function tryPlayCard(card: WhotCard) {
    if (!canPlayCard(card, topCard, state.calledSuit)) {
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
    // Last Card Rule Check
    if ((state.hands[sessionId] || []).length === 1 && !hasDeclaredLastCard) {
      alert("⚠️ You didn't call LAST CARD! You must draw 1 penalty card.");
      // Draw penalty, skip turn
      const newDeck = [...state.deck];
      const drawn = newDeck.splice(0, 1);
      const newHand = [...(state.hands[sessionId] || []), ...drawn];
      const newState = {
        ...state,
        deck: newDeck,
        hands: { ...state.hands, [sessionId]: newHand },
        turn: getNextTurn(game.players, sessionId)
      };
      await supabase.from("space_games").update({ game_state: newState }).eq("id", game.id);
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

    if (card.value === 2) {
      nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 2)];
      nextTurn = getNextTurn(game.players, nextTurn);
      actionText += ". Bot picks 2!";
    } else if (card.value === 5) {
      nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 3)];
      nextTurn = getNextTurn(game.players, nextTurn);
      actionText += ". Bot picks 3!";
    } else if (card.value === 8) {
      if (card.suit === "star") {
        nextTurn = getNextTurn(game.players, nextTurn, 2);
        actionText += ". Skip 2!";
      } else {
        nextTurn = getNextTurn(game.players, nextTurn);
        actionText += ". Bot skips!";
      }
    } else if (card.value === 14) {
      for (const p of game.players) {
        if (p !== sessionId) nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
      }
      actionText += ". Bot picks 1!";
    } else if (card.value === 1) {
      nextTurn = sessionId;
      actionText += ". Continue.";
    }

    const newState: WhotState = {
      ...state,
      hands: nextHands,
      discard: newDiscard,
      deck: newDeck,
      turn: nextTurn,
      calledSuit: calledSuit,
      winner: newHand.length === 0 ? sessionId : null,
      status: newHand.length === 0 ? "finished" : "playing"
    };

    setLastAction(actionText);
    playProfile("bbm", "send");
    vibrate(30);
    
    // Reset Last Card declaration
    setHasDeclaredLastCard(false);

    await supabase.from("space_games").update({ game_state: newState }).eq("id", game.id);
    
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

    const drawn = newDeck.splice(0, 1);
    newHand.push(...drawn);
    
    const newState: WhotState = {
      ...state,
      deck: newDeck,
      hands: { ...state.hands, [sessionId]: newHand },
      turn: getNextTurn(game.players, sessionId)
    };

    setLastAction(`You picked 1 card.`);
    playProfile("bbm", "send");
    await supabase.from("space_games").update({ game_state: newState }).eq("id", game.id);
    
    setIsProcessing(false);
  }

  function confirmQuit() {
    if (window.confirm("Are you sure you want to leave the game? Your progress will be lost.")) {
      onQuit();
    }
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
        style={{ touchAction: 'none', ...style }}
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

  return (
    <div className="w-full h-full flex flex-col bg-[#0a2e16] rounded-xl overflow-hidden relative select-none">
      
      {/* Top Bar / Opponents */}
      <div className="flex justify-between items-center text-white/90 text-xs p-2 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Alama seed="bot" size={32} />
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0a2e16] ${state.turn === "bot" ? 'bg-yellow-500' : 'bg-gray-500'}`} />
          </div>
          <div>
            <span className={`px-2 py-1 rounded font-bold ${state.turn === "bot" ? 'text-yellow-500' : 'text-white/70'}`}>
              Bot
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
              You
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
          <button onClick={() => { setHasDeclaredLastCard(true); playProfile("bbm", "mention"); }} className={`px-3 py-1 rounded ${hasDeclaredLastCard ? 'bg-green-600 text-white' : 'bg-red-600 text-white animate-pulse'}`}>
            {hasDeclaredLastCard ? "Last Card Declared ✓" : "⚠️ TAP TO SAY LAST CARD"}
          </button>
        ) :
         isLast && isMyTurn ? "🚨 PLAY YOUR LAST CARD!" :
         isMyTurn ? "⚡ YOUR TURN! Play a card or go to market." : lastAction}
      </div>

      {/* Center Table */}
      <div className="flex-1 flex items-center justify-center gap-6 relative">
        <button 
          onClick={pickFromMarket}
          disabled={!isMyTurn || isProcessing}
          className="relative w-16 h-24 bg-[#8B3A2B] rounded-md shadow-lg border-2 border-[#5A2217] flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition-transform"
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
          onClick={confirmQuit} 
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
          const isPlayable = isMyTurn && canPlayCard(card, topCard, state.calledSuit);
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
        return (
          <div className="fixed pointer-events-none z-[100]" style={{ left: dragState.x - 32, top: dragState.y - 48 }}>
            <CardUI card={card} isDragging={true} />
          </div>
        );
      })()}

      {/* Whot Suit Picker */}
      {suitPickerOpen && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <h3 className="text-white font-bold mb-4 text-xl">Call a Suit!</h3>
          <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
            {(["circle", "triangle", "cross", "square", "star"] as WhotSuit[]).map(s => (
              <button
                key={s}
                onClick={() => playCard(selectedCard!, s)}
                className="p-4 bg-[#FDFBF7] rounded-xl text-xl flex flex-col items-center text-[#8B3A2B] font-bold active:scale-95 transition-transform"
              >
                <div className="w-8 h-8 mb-1 text-[#8B3A2B]">
                  <SuitIcon suit={s} />
                </div>
                <span className="text-[0.65rem] uppercase">{s}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setSuitPickerOpen(false)} className="mt-6 text-sm text-red-400 font-bold hover:text-white">Cancel</button>
        </div>
      )}

      {/* Game Over Overlay */}
      {state.status === "finished" && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-6xl mb-4">{state.winner === sessionId ? "🏆" : "😔"}</div>
          <h2 className="text-3xl font-black text-white mb-2">{state.winner === sessionId ? "YOU WON!" : "BOT WON"}</h2>
          
          <div className="flex gap-4 mb-8 bg-white/10 px-6 py-3 rounded-2xl border border-white/20">
             <div className="text-center">
               <p className="text-[0.65rem] text-white/50 uppercase tracking-wider">Wins</p>
               <p className="text-2xl font-bold text-green-400">{wins}</p>
             </div>
             <div className="w-px bg-white/20"></div>
             <div className="text-center">
               <p className="text-[0.65rem] text-white/50 uppercase tracking-wider">Losses</p>
               <p className="text-2xl font-bold text-red-400">{losses}</p>
             </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-[200px]">
            <button onClick={onQuit} className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-lg active:scale-95 transition-transform">Exit to Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}