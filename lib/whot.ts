export type WhotSuit = "circle" | "triangle" | "cross" | "square" | "star";
export type WhotCard = { id: string; suit: WhotSuit | "whot"; value: number; };
export type WhotState = {
  deck: WhotCard[]; discard: WhotCard[]; hands: Record<string, WhotCard[]>; 
  turn: string; calledSuit: WhotSuit | null; status: "waiting" | "playing" | "finished";
  winner: string | null; useAnyplay: boolean;
};
const SUITS: WhotSuit[] = ["circle", "triangle", "cross", "square", "star"];
export function createWhotDeck(useAnyplay: boolean): WhotCard[] {
  const deck: WhotCard[] = []; let idCounter = 1;
  for (const suit of SUITS) {
    for (let v = 1; v <= 14; v++) deck.push({ id: `c${idCounter++}`, suit, value: v });
  }
  if (useAnyplay) { for (let i = 0; i < 5; i++) deck.push({ id: `c${idCounter++}`, suit: "whot", value: 20 }); }
  return deck;
}
export function shuffleDeck(deck: WhotCard[]): WhotCard[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}
export function startWhotGame(players: string[], useAnyplay: boolean): WhotState {
  const deck = shuffleDeck(createWhotDeck(useAnyplay)); const hands: Record<string, WhotCard[]> = {};
  players.forEach((pid) => { hands[pid] = deck.splice(0, 5); });
  let firstCard = deck.pop()!;
  while (firstCard.value === 20) { deck.unshift(firstCard); firstCard = deck.pop()!; }
  return { deck, discard: [firstCard], hands, turn: players[0], calledSuit: null, status: "playing", winner: null, useAnyplay };
}
export function canPlayCard(card: WhotCard, topCard: WhotCard, calledSuit: WhotSuit | null): boolean {
  if (card.value === 20) return true;
  if (calledSuit) return card.suit === calledSuit || card.value === topCard.value;
  return card.suit === topCard.suit || card.value === topCard.value;
}
export function getNextTurn(players: string[], currentTurn: string, steps: number = 1): string {
  return players[(players.indexOf(currentTurn) + steps) % players.length];
}