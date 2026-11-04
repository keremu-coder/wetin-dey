import {
  WhotCard,
  WhotSuit,
  WhotState,
  canPlayCard,
  getNextTurn,
  shuffleDeck,
  startWhotGame
} from "./whot";
import { getBotMove, BotAction } from "./whot-bot";

/**
 * Authoritative Whot rules. Pure functions only (no React, no database), so the
 * server can validate every move and the same code can be unit-tested.
 */

export const ALL_SUITS: WhotSuit[] = ["circle", "triangle", "cross", "square", "star"];

export function getCardName(card: WhotCard): string {
  if (card.value === 20) return "WHOT 20";
  if (card.value === 1) return "HOLD ON";
  if (card.value === 2) return "PICK 2";
  if (card.value === 5) return "PICK 3";
  if (card.value === 8) return card.suit === "star" ? "STAR 8" : "SUSPENSION";
  if (card.value === 14) return "GENERAL MARKET";
  return `${card.value} ${card.suit.toUpperCase()}`;
}

export function bestSuitFor(hand: WhotCard[]): WhotSuit {
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

/** Draw cards. When the market is empty the discard pile (minus its top card) is reshuffled in and removed from the discard. */
export function drawCards(
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

export function resolvePlay(
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
  } else if (card.value === 5) {
    activePenalty = (state.penaltyType === "5" ? state.activePenalty : 0) + 3;
    penaltyType = "5";
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
    lastCardCalledBy: null,
    activePenalty,
    penaltyType
  };
  return { next, text };
}

/** Pick from the market: the whole pending penalty if there is one, otherwise a single card. */
export function resolvePick(
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
    lastCardCalledBy: null,
    activePenalty: 0,
    penaltyType: null
  };
  return { next, drawnCount: d.drawn.length };
}

/** Under a penalty the bot prefers to stack, and a Whot card always carries a called suit. */
export function normalizeBotMove(
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

/* ------------------------------------------------------------------ */
/* Move validation (this is what the server runs for every request)    */
/* ------------------------------------------------------------------ */

export type MoveInput = {
  action: unknown;
  cardId?: unknown;
  calledSuit?: unknown;
  declaredLastCard?: unknown;
};

export type MoveResult =
  | { ok: true; next: WhotState; text: string; penalty?: boolean }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): MoveResult => ({ ok: false, status, error });

function isSuit(v: unknown): v is WhotSuit {
  return typeof v === "string" && (ALL_SUITS as string[]).includes(v);
}

/** Validates and applies one action by `actorId`. Never trusts anything the client sends except the intent. */
export function applyMove(
  state: WhotState,
  players: string[],
  actorId: string,
  input: MoveInput,
  nameOf: (id: string) => string
): MoveResult {
  if (!state || !state.hands || !state.discard || !state.deck) return fail(409, "Game is not ready");
  if (!players.includes(actorId)) return fail(403, "Not a player");

  if (input.action === "reset") {
    if (state.status !== "finished") return fail(409, "Game not finished");
    return { ok: true, next: { ...startWhotGame(players, state.useAnyplay), rev: (state.rev ?? 0) + 1 }, text: "New game started" };
  }

  if (input.action === "declare_last_card") {
    if (state.status !== "playing") return fail(409, "Game not active");
    if (state.turn !== actorId) return fail(403, "Not your turn");
    if ((state.hands[actorId] || []).length !== 2) return fail(409, "You can only call your last card with two cards");
    if (state.lastCardCalledBy === actorId) {
      return { ok: true, next: state, text: "Last card already called" };
    }
    return {
      ok: true,
      next: { ...state, lastCardCalledBy: actorId, rev: (state.rev ?? 0) + 1 },
      text: "Last card called"
    };
  }

  if (state.status !== "playing") return fail(409, "Game not active");

  // The bot moves on the server, on behalf of the room. Any seated player may ask for it, but only on the bot's turn.
  if (input.action === "bot_move") {
    if (!players.includes("bot")) return fail(400, "No bot in this game");
    if (state.turn !== "bot") return fail(409, "Not bot turn");
    const hand = state.hands["bot"] || [];
    const counts = players.filter((p) => p !== "bot").map((p) => state.hands[p]?.length || 0);
    const raw = getBotMove(hand, state.discard[state.discard.length - 1], state.calledSuit, state.activePenalty, state.penaltyType, counts);
    const move = normalizeBotMove(raw, hand, state.activePenalty, state.penaltyType);
    if (move && move.action === "play") {
      const r = resolvePlay(state, players, "bot", move.card, move.calledSuit ?? null, actorId, nameOf);
      return { ok: true, next: { ...r.next, rev: (state.rev ?? 0) + 1 }, text: r.text };
    }
    const r = resolvePick(state, players, "bot");
    return { ok: true, next: { ...r.next, rev: (state.rev ?? 0) + 1 }, text: `${nameOf("bot")} picked ${r.drawnCount} card(s).` };
  }

  if (actorId === "bot") return fail(403, "Not allowed");
  if (state.turn !== actorId) return fail(403, "Not your turn");
  const myHand = state.hands[actorId] || [];

  if (input.action === "pick") {
    const r = resolvePick(state, players, actorId);
    return { ok: true, next: { ...r.next, rev: (state.rev ?? 0) + 1 }, text: `You picked ${r.drawnCount} card(s).` };
  }

  if (input.action === "play") {
    if (typeof input.cardId !== "string") return fail(400, "cardId required");
    const card = myHand.find((c) => c.id === input.cardId);
    if (!card) return fail(400, "Card not in hand");
    const top = state.discard[state.discard.length - 1];
    if (!canPlayCard(card, top, state.calledSuit, state.activePenalty, state.penaltyType)) return fail(400, "Invalid move");

    let suit: WhotSuit | null = null;
    if (card.value === 20) {
      if (!isSuit(input.calledSuit)) return fail(400, "calledSuit required for Whot");
      suit = input.calledSuit;
    }

    // Last card rule: with two cards in hand you must have called it before playing.
    if (myHand.length === 2 && state.lastCardCalledBy !== actorId) {
      const d = drawCards(state.deck, state.discard, 1);
      const next: WhotState = {
        ...state,
        deck: d.deck,
        discard: d.discard,
        hands: { ...state.hands, [actorId]: [...myHand, ...d.drawn] },
        lastCardCalledBy: null,
        // A still-pending pick penalty stays with this player.
        turn: state.activePenalty > 0 ? actorId : getNextTurn(players, actorId),
        rev: (state.rev ?? 0) + 1
      };
      return { ok: true, next, text: "You forgot to call LAST CARD. Penalty: pick 1.", penalty: true };
    }

    const r = resolvePlay(state, players, actorId, card, suit, actorId, nameOf);
    return { ok: true, next: { ...r.next, rev: (state.rev ?? 0) + 1 }, text: r.text };
  }

  return fail(400, "unknown action");
}

/* ------------------------------------------------------------------ */
/* Hidden information                                                  */
/* ------------------------------------------------------------------ */

const hiddenCard = (i: number): WhotCard => ({ id: "hidden-" + i, suit: "circle", value: 0 });

/** What a given viewer may see: their own cards, everyone else's card COUNT, and the size of the market. */
export function maskStateFor(state: WhotState, viewerId: string): WhotState {
  if (!state || !state.hands) return state;
  const hands: Record<string, WhotCard[]> = {};
  for (const id of Object.keys(state.hands)) {
    const h = state.hands[id] || [];
    hands[id] = id === viewerId ? h : h.map((_, i) => hiddenCard(i));
  }
  const deck = (state.deck || []).map((_, i) => hiddenCard(i));
  return { ...state, hands, deck };
}
