"use client";

import { useState, useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { WhotCard, WhotSuit, canPlayCard, WhotState, getNextTurn } from "@/lib/whot";
import { getBotMove } from "@/lib/whot-bot";
import { playProfile, unlockAudio, vibrate } from "@/lib/sounds";

const SUIT_ICONS = {
  circle: "⬤",
  triangle: "▲",
  cross: "✖",
  square: "◼",
  star: "★",
  whot: "WHOT"
};

function getCardName(card: WhotCard): string {
  if (card.value === 20) return "WHOT 20";
  if (card.value === 1) return "HOLD ON";
  if (card.value === 2) return "PICK 2";
  if (card.value === 5) return "PICK 3";
  if (card.value === 8) return "SUSPENSION";
  if (card.value === 14) return "GENERAL MARKET";
  return `${card.value} of ${card.suit.toUpperCase()}`;
}

export function WhotGame({ game, isPlayer, sessionId }: { game: any, isPlayer: boolean, sessionId: string }) {
  const supabase = getBrowserClient();
  const state: WhotState = game.game_state;
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WhotCard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Game started");

  const topCard = state?.discard[state.discard.length - 1];
  const isMyTurn = state?.turn === sessionId;
  const isBotTurn = state?.turn === "bot";

  useEffect(() => {
    unlockAudio();
  }, []);

  // Alert when it becomes your turn
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

        if (move.card.value === 2) {
          nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 2)];
          nextTurn = getNextTurn(game.players, nextTurn);
        } else if (move.card.value === 5) {
          nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 3)];
          nextTurn = getNextTurn(game.players, nextTurn);
        } else if (move.card.value === 8) {
          nextTurn = getNextTurn(game.players, nextTurn);
        } else if (move.card.value === 14) {
          // General market: everyone else picks 1
          for (const p of game.players) {
            if (p !== "bot") nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
          }
        } else if (move.card.value === 1) {
          nextTurn = "bot";
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

        setLastAction(`🤖 Bot played ${getCardName(move.card)}${move.calledSuit ? ` (${move.calledSuit})` : ""}`);
        playProfile("bbm", "receive");
        await supabase.from("space_games").update({ game_state: newState }).eq("id", game.id);
      }
      setIsProcessing(false);
    }, 1800); // 1.8 seconds feels like a real person thinking

    return () => clearTimeout(timer);
  }, [isBotTurn, state, topCard, isProcessing, game.id, game.players]);

  if (!state || !state.hands) return <div className="text-center text-muted p-4">Dealing cards...</div>;

  const myHand = state.hands[sessionId] || [];

  async function playCard(card: WhotCard, calledSuit: WhotSuit | null = null) {
    if (!isMyTurn || isProcessing) return;
    setIsProcessing(true);
    
    const newHand = myHand.filter(c => c.id !== card.id);
    const newHands: Record<string, WhotCard[]> = { ...state.hands, [sessionId]: newHand };
    const newDiscard = [...state.discard, card];

    let nextTurn = getNextTurn(game.players, sessionId);
    let newDeck = [...state.deck];
    let nextHands: Record<string, WhotCard[]> = { ...newHands };

    if (card.value === 2) {
      nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 2)];
      nextTurn = getNextTurn(game.players, nextTurn);
    } else if (card.value === 5) {
      nextHands[nextTurn] = [...nextHands[nextTurn], ...newDeck.splice(0, 3)];
      nextTurn = getNextTurn(game.players, nextTurn);
    } else if (card.value === 8) {
      nextTurn = getNextTurn(game.players, nextTurn);
    } else if (card.value === 14) {
      for (const p of game.players) {
        if (p !== sessionId) nextHands[p] = [...nextHands[p], ...newDeck.splice(0, 1)];
      }
    } else if (card.value === 1) {
      nextTurn = sessionId;
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

    setLastAction(`You played ${getCardName(card)}${calledSuit ? ` (${calledSuit})` : ""}`);
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
    let newHand = [...myHand];
    
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

  function handleCardClick(card: WhotCard) {
    if (!isMyTurn || isProcessing) return;
    if (!canPlayCard(card, topCard, state.calledSuit)) {
      // Just a subtle feedback if they try to play an invalid card
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

  const CardUI = ({ card, isPlayable, onClick }: { card: WhotCard, isPlayable?: boolean, onClick?: () => void }) => {
    const isWhot = card.value === 20;
    return (
      <button
        onClick={onClick}
        disabled={!isPlayable && onClick != null}
        className={`relative flex flex-col justify-between items-center bg-[#FDFBF7] rounded-md overflow-hidden select-none transition-transform ${
          onClick ? (isPlayable ? "shadow-md -translate-y-2 border-2 border-[#8B3A2B] cursor-pointer" : "bg-gray-200 opacity-60") : "border border-gray-300 w-16 h-24 shadow-xl"
        }`}
        style={{ width: onClick ? '3rem' : '4rem', height: onClick ? '4.5rem' : '6rem' }}
      >
        <div className="absolute top-1 left-1 flex flex-col items-center leading-none text-[#8B3A2B]">
          <span className="text-[0.7rem] font-bold">{card.value}</span>
          <span className="text-[0.6rem]">{SUIT_ICONS[card.suit as keyof typeof SUIT_ICONS]}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
           <span className={`text-[#8B3A2B] ${isWhot ? 'font-black text-lg tracking-tighter' : 'text-3xl'}`}>
             {SUIT_ICONS[card.suit as keyof typeof SUIT_ICONS]}
           </span>
        </div>
        <div className="absolute bottom-1 right-1 flex flex-col items-center leading-none text-[#8B3A2B] rotate-180">
          <span className="text-[0.7rem] font-bold">{card.value}</span>
          <span className="text-[0.6rem]">{SUIT_ICONS[card.suit as keyof typeof SUIT_ICONS]}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0a2e16] rounded-xl overflow-hidden relative">
      {/* Top Bar / Opponents */}
      <div className="flex justify-between items-center text-white/90 text-xs p-2 bg-black/40 shrink-0">
        {game.players.filter((p: string) => p !== sessionId).map((pid: string) => {
          const isBot = pid === "bot";
          const name = isBot ? "🤖 Bot" : `Player`;
          return (
            <div key={pid} className={`px-2 py-1 rounded ${state.turn === pid ? 'bg-yellow-500 text-black font-bold' : ''}`}>
              {name}: {state.hands[pid]?.length || 0} cards
            </div>
          );
        })}
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
          className="relative w-14 h-20 bg-[#8B3A2B] rounded-md shadow-lg border-2 border-[#5A2217] flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition-transform"
        >
          <span className="text-[10px] font-bold rotate-[-15deg] text-white/40 uppercase tracking-widest">Whot</span>
          <div className="absolute -bottom-5 text-white text-[10px] font-semibold bg-black/50 px-2 py-0.5 rounded-full whitespace-nowrap">
            {state.deck.length} left
          </div>
        </button>

        <div className="relative">
           <CardUI card={topCard} />
           {state.calledSuit && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[0.6rem] text-yellow-300 font-bold whitespace-nowrap bg-black/60 px-2 py-1 rounded-full uppercase">
              Play: {state.calledSuit}
            </div>
          )}
        </div>
      </div>

      {/* My Hand */}
      <div className="h-28 bg-black/40 p-2 flex gap-1.5 overflow-x-auto items-center shrink-0" style={{ touchAction: 'pan-x' }}>
        {myHand.map((card) => {
          const playable = isMyTurn && canPlayCard(card, topCard, state.calledSuit);
          return (
            <CardUI 
              key={card.id} 
              card={card} 
              isPlayable={playable} 
              onClick={() => handleCardClick(card)} 
            />
          );
        })}
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
                <span className="text-3xl mb-1">{SUIT_ICONS[s]}</span>
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