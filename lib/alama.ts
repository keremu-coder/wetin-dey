export type AlamaShape = 0 | 1 | 2 | 3 | 4 | 5;
export type AlamaPattern = 0 | 1 | 2 | 3;
export type AlamaRarity = "common" | "uncommon" | "rare" | "legendary";

export type Alama = {
  shape: AlamaShape;
  pattern: AlamaPattern;
  bg: string;
  fg: string;
  rarity: AlamaRarity;
};

// One palette. Muted. Nigerian. Never a rainbow.
const PALETTE = [
  "#0A6B43", // leaf
  "#2B4A9E", // adire
  "#A3203A", // zobo
  "#A8501F", // clay
  "#6A2E73", // plum
  "#0F6A73"  // lagoon
] as const;

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function alamaFrom(seed: string): Alama {
  const h = hash32(seed || "anonymous");
  const shape = (h % 6) as AlamaShape;
  const pattern = ((h >>> 4) % 4) as AlamaPattern;
  const bg = PALETTE[(h >>> 8) % 6];
  let fg = PALETTE[(h >>> 12) % 6];
  if (fg === bg) fg = PALETTE[((h >>> 12) + 1) % 6];

  let rarity: AlamaRarity = "common";
  if (shape === 1 && pattern === 2) rarity = "legendary";      // Adire Hex + diagonal
  else if (shape === 5 && pattern === 3) rarity = "legendary"; // Naija Star + ring
  else if (shape === 4 && pattern === 1) rarity = "rare";      // Shield + dots
  else if (shape === 2 && pattern === 3) rarity = "rare";      // Uli Petal + ring
  else if (pattern === 0) rarity = "common";
  else rarity = "uncommon";

  return { shape, pattern, bg, fg, rarity };
}

// 100x100 viewBox. Every shape sits inside r=48 so nothing clips.
export const SHAPE_PATH: Record<AlamaShape, string> = {
  0: "M50 4 A46 46 0 1 1 49.99 4 Z",                                        // Circle — universal
  1: "M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z",                             // Adire Hex
  2: "M50 4 C72 4 96 28 96 50 C96 72 72 96 50 96 C28 96 4 72 4 50 C4 28 28 4 50 4 Z", // Uli Petal
  3: "M50 4 L96 50 L50 96 L4 50 Z",                                          // Aya Diamond
  4: "M50 4 L92 22 L92 58 Q92 86 50 96 Q8 86 8 58 L8 22 Z",                  // Hausa Shield
  5: "M50 4 L60 38 L96 38 L67 58 L77 92 L50 72 L23 92 L33 58 L4 38 L40 38 Z" // Naija Star
};

export const SHAPE_LABEL: Record<AlamaShape, string> = {
  0: "Circle",
  1: "Adire Hex",
  2: "Uli Petal",
  3: "Aya Diamond",
  4: "Hausa Shield",
  5: "Naija Star"
};