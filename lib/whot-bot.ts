import { WhotCard, WhotSuit, canPlayCard } from "./whot";

export type BotAction = 
  | { action: "play"; card: WhotCard; calledSuit?: WhotSuit }
  | { action: "pick" }
  | null;

export function getBotMove(
  hand: WhotCard[],
  topCard: WhotCard,
  calledSuit: WhotSuit | null,
  opponentCardCounts: number[]
): BotAction {
  const playable = hand.filter(c => canPlayCard(c, topCard, calledSuit));
  
  if (playable.length === 0) return { action: "pick" };

  const minOppCards = opponentCardCounts.length > 0 ? Math.min(...opponentCardCounts) : 99;

  // 1. WIN THE GAME: If we have 1 card left and it's playable, play it.
  if (hand.length === 1) {
    return { action: "play", card: playable[0] };
  }

  // 2. DEFENSIVE PLAY: If opponent has 1 or 2 cards left, hit them with a penalty card!
  if (minOppCards <= 2) {
    const blockCard = playable.find(c => c.value === 5) // Pick 3
      || playable.find(c => c.value === 2)             // Pick 2
      || playable.find(c => c.value === 8)             // Suspension
      || playable.find(c => c.value === 14);           // General Market
    if (blockCard) return { action: "play", card: blockCard };
  }

  // 3. TACTICAL PLAY: Play "Hold On" (1) if we have other cards to play next
  const holdOn = playable.find(c => c.value === 1);
  if (holdOn && hand.length > 2) return { action: "play", card: holdOn };

  // 4. CHAOS PLAY: Play special cards (2, 5, 8, 14) to control the game
  if (hand.length > 3) {
    const specialCard = playable.find(c => [2, 5, 8, 14].includes(c.value));
    if (specialCard) return { action: "play", card: specialCard };
  }

  // 5. NORMAL PLAY: Play a normal card, preferring to stick to the current suit
  const normalCards = playable.filter(c => c.value !== 20);
  if (normalCards.length > 0) {
    const suitMatch = normalCards.find(c => c.suit === topCard.suit || c.suit === calledSuit);
    if (suitMatch) return { action: "play", card: suitMatch };
    return { action: "play", card: normalCards[0] };
  }

  // 6. EMERGENCY: Only use Whot 20 if there are no other options
  const whotCard = playable.find(c => c.value === 20);
  if (whotCard) {
    const suitCounts: Record<string, number> = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0 };
    for (const c of hand) {
      if (c.suit !== "whot") suitCounts[c.suit]++;
    }
    let bestSuit: WhotSuit = "circle";
    let maxCount = -1;
    for (const [suit, count] of Object.entries(suitCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestSuit = suit as WhotSuit;
      }
    }
    return { action: "play", card: whotCard, calledSuit: bestSuit };
  }

  return { action: "pick" };
}