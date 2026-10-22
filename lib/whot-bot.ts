import { WhotCard, WhotSuit, canPlayCard } from "./whot";

export type BotAction = 
  | { action: "play"; card: WhotCard; calledSuit?: WhotSuit }
  | { action: "pick" }
  | null;

export function getBotMove(
  hand: WhotCard[],
  topCard: WhotCard,
  calledSuit: WhotSuit | null,
  activePenalty: number,
  penaltyType: "2" | "5" | null,
  opponentCardCounts: number[]
): BotAction {
  const playable = hand.filter(c => canPlayCard(c, topCard, calledSuit, activePenalty, penaltyType));
  
  if (playable.length === 0) return { action: "pick" };

  // If under penalty, must play the penalty card
  if (activePenalty > 0) {
    return { action: "play", card: playable[0] };
  }

  const minOppCards = opponentCardCounts.length > 0 ? Math.min(...opponentCardCounts) : 99;

  if (hand.length === 1) {
    return { action: "play", card: playable[0] };
  }

  if (minOppCards <= 2) {
    const blockCard = playable.find(c => c.value === 5) 
      || playable.find(c => c.value === 2) 
      || playable.find(c => c.value === 8) 
      || playable.find(c => c.value === 14);
    if (blockCard) return { action: "play", card: blockCard };
  }

  const holdOn = playable.find(c => c.value === 1);
  if (holdOn && hand.length > 2) return { action: "play", card: holdOn };

  if (hand.length > 3) {
    const specialCard = playable.find(c => [2, 8, 14].includes(c.value));
    if (specialCard) return { action: "play", card: specialCard };
  }

  const normalCards = playable.filter(c => c.value !== 20);
  if (normalCards.length > 0) {
    const suitMatch = normalCards.find(c => c.suit === topCard.suit || c.suit === calledSuit);
    if (suitMatch) return { action: "play", card: suitMatch };
    return { action: "play", card: normalCards[0] };
  }

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