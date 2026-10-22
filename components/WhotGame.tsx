"use client";

import { useState, useEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { WhotCard, WhotSuit, canPlayCard, WhotState, getNextTurn } from "@/lib/whot";
import { getBotMove } from "@/lib/whot-bot";
import { playProfile, unlockAudio, vibrate } from "@/lib/sounds";

// Pure SVG Icons for perfect rendering on all devices
const SvgCircle = () => <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><circle cx="12" cy="12" r="10"/></svg>;
const SvgTriangle = () => <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><polygon points="12,2 23,22 1,22"/></svg>;
const SvgCross = () => <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M4 4 L20 20 M4 20 L20 4" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>;
const SvgSquare = () => <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><rect x="2" y="2" width="20" height="20"/></svg>;
const SvgStar = () => <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/></svg>;

function SuitIcon({ suit, className = "w-8 h-8" }: { suit: string, className?: string }) {
  const props = { className };
  if (suit === "circle") return <SvgCircle />;
  if (suit === "triangle") return <SvgTriangle />;
  if (suit === "cross") return <SvgCross />;
  if (suit === "square") return <SvgSquare />;
  if (suit === "star") return <SvgStar />;
  return null;
}

function getCardName(card: WhotCard): string {
  if (card.value === 20) return "WHOT 20";
  if (card.value === 1) return "HOLD ON";
  if (card.value === 2) return "PICK 2";
  if (card.value === 5) return "PICK 3";
  if (card.value === 8) return "SUSPENSION";
  if (card.value === 14) return "GENERAL MARKET";
  return `${card.value} of ${card.suit.toUpperCase()}`;
}

const DRAG_THRESHOLD = 10;

export function WhotGame({ game, isPlayer, sessionId }: { game: any, isPlayer: boolean, sessionId: string }) {
  const supabase = getBrowserClient();
  const state: WhotState = game.game_state;
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WhotCard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Game started");
  
  const [dragState, setDragState] = useState<{ id: string, x: number, y: number } | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const discardRef = useRef<HTMLDivElement>(null);

  const topCard = state?.discard[state.discard.length - 1];
  const isMyTurn = state?.turn === sessionId;
  const isBotTurn = state?.turn === "bot";

  useEffect(() => {
    unlockAudio();
  }, []);

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
        
        const drawn = newDeck.pop()!;
        newHand.push(drawn);
        
        const newState: WhotState = {
          ...state,
          deck: newDeck,
          hands: { ...state.hands, ["bot"]: newHand },
          turn: canPlayCard(drawn, topCard, state.calledSuit) ? "bot" : getNextTurn(game.players, "bot")
        };

        setLastAction("🤖 Bot went to Market.");
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
          nextTurn = getNextTurn(game.players, nextTurn);
          actionText += ". You are suspended!";
        } else if (move.card.value === 14) {
          for (const p of game.players) {
            if (p !== "bot") nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
          }
          actionText += ". You pick 1!";
        } else if (move.card.value === 1) {
          nextTurn = "bot";
          actionText += ". Bot holds on.";
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

  function tryPlayCard(card: WhotCard) {
    if (!isMyTurn || isProcessing) return;
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

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, card: WhotCard) {
    if (!isMyTurn || isProcessing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    setDragState({ id: card.id, x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragState) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) {
      isDraggingRef.current = true;
    }
    setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>, card: WhotCard) {
    if (!dragState) return;
    const wasDragging = isDraggingRef.current;
    setDragState(null);
    isDraggingRef.current = false;

    if (!wasDragging) {
      tryPlayCard(card);
      return;
    }

    if (!discardRef.current) return;
    const rect = discardRef.current.getBoundingClientRect();
    if (
      e.clientX >= rect.left - 40 && e.clientX <= rect.right + 40 && 
      e.clientY >= rect.top - 40 && e.clientY <= rect.bottom + 40
    ) {
      tryPlayCard(card);
    }
  }

  async function playCard(card: WhotCard, calledSuit: WhotSuit | null = null) {
    if (!isMyTurn || isProcessing) return;
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
      nextTurn = getNextTurn(game.players, nextTurn);
      actionText += ". Bot is suspended!";
    } else if (card.value === 14) {
      for (const p of game.players) {
        if (p !== sessionId) nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
      }
      actionText += ". Bot picks 1!";
    } else if (card.value === 1) {
      nextTurn = sessionId;
      actionText += ". You hold on.";
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

    if (newDeck.length > 0) {
      const drawn = newDeck.pop()!;
      newHand.push(drawn);
      
      const newState: WhotState = {
        ...state,
        deck: newDeck,
        hands: { ...state.hands, [sessionId]: newHand },
        turn: canPlayCard(drawn, topCard, state.calledSuit) ? sessionId : getNextTurn(game.players, sessionId)
      };

      setLastAction("You went to Market.");
      playProfile("bbm", "send");
      await supabase.from("space_games").update({ game_state: newState }).eq("id", game.id);
    }
    
    setIsProcessing(false);
  }

  if (!state || !state.hands) return <div className="text-center text-muted p-4">Dealing cards...</div>;

  const myHand = state.hands[sessionId] || [];
  const botHandCount = state.hands["bot"]?.length || 0;

  const CardUI = ({ card, isDragging, onPointerDown, onPointerMove, onPointerUp, style }: any) => {
    const isWhot = card.value === 20;
    return (
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: 'none', ...style }}
        className={`relative flex flex-col justify-between items-center bg-[#FDFBF7] rounded-md overflow-hidden select-none shadow-md border border-gray-300 w-16 h-24 shrink-0 ${
          isDragging ? 'z-50 shadow-2xl scale-110 cursor-grabbing opacity-90 fixed pointer-events-none' : 'cursor-grab hover:-translate-y-1 transition-transform'
        }`}
      >
        <div className="absolute top-1 left-1 flex flex-col items-center leading-none text-[#8B3A2B]">
          <span className="text-[0.8rem] font-bold">{card.value}</span>
          <SuitIcon suit={card.suit} className="w-3 h-3 mt-0.5" />
        </div>
        <div className="flex-1 flex items-center justify-center">
           {isWhot ? (
             <span className="text-[#8B3A2B] font-black text-lg tracking-tighter">WHOT</span>
           ) : (
             <SuitIcon suit={card.suit} className="w-8 h-8 text-[#8B3A2B]" />
           )}
        </div>
        <div className="absolute bottom-1 right-1 flex flex-col items-center leading-none text-[#8B3A2B] rotate-180">
          <span className="text-[0.8rem] font-bold">{card.value}</span>
          <SuitIcon suit={card.suit} className="w-3 h-3 mt-0.5" />
        </div>
      </button>
    );
  };

  const CardBack = () => (
    <div className="w-5 h-7 bg-[#8B3A2B] border border-[#5A2217] rounded-[2px] shadow-sm shrink-0" />
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#0a2e16] rounded-xl overflow-hidden relative select-none">
      
      {/* Opponent Hand */}
      <div className="flex justify-between items-center text-white/90 text-xs p-2 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded font-bold ${state.turn === "bot" ? 'bg-yellow-500 text-black' : 'text-white/70'}`}>
            🤖 Bot
          </span>
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(botHandCount, 12) }).map((_, i) => (
              <CardBack key={i} />
            ))}
            {botHandCount > 12 && (
              <div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-[10px] font-bold z-10 -ml-1 border border-white/20">
                +{botHandCount - 12}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Log / Alert Banner */}
      <div className={`text-center py-2 text-xs font-bold shrink-0 transition-colors ${isMyTurn ? 'bg-yellow-500 text-black' : 'bg-black/20 text-white/70'}`}>
        {state.status === "finished" ? (
          state.winner === sessionId ? "🎉 YOU WON!" : "😔 Bot Won."
        ) : isMyTurn ? (
          "⚡ YOUR TURN! Play a card or go to market."
        ) : (
          lastAction
        )}
      </div>

      {/* Center Table */}
      <div className="flex-1 flex items-center justify-center gap-6">
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

        <div ref={discardRef} className="relative">
           <CardUI card={topCard} />
           {state.calledSuit && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[0.6rem] text-yellow-300 font-bold whitespace-nowrap bg-black/60 px-2 py-1 rounded-full uppercase">
              Play: {state.calledSuit}
            </div>
          )}
        </div>
      </div>

      {/* My Hand */}
      <div className="h-32 bg-black/40 p-2 flex gap-2 overflow-x-auto items-center shrink-0" style={{ touchAction: 'pan-x' }}>
        {myHand.map((card) => (
          <CardUI 
            key={card.id} 
            card={card} 
            isDragging={dragState?.id === card.id}
            style={dragState?.id === card.id ? { left: dragState.x - 32, top: dragState.y - 48 } : {}}
            onPointerDown={(e: any) => onPointerDown(e, card)}
            onPointerMove={onPointerMove}
            onPointerUp={(e: any) => onPointerUp(e, card)}
          />
        ))}
      </div>

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
                <SuitIcon suit={s} className="w-8 h-8 mb-1 text-[#8B3A2B]" />
                <span className="text-[0.65rem] uppercase">{s}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setSuitPickerOpen(false)} className="mt-6 text-sm text-red-400 font-bold hover:text-white">Cancel</button>
        </div>
      )}
    </div>
  );
}