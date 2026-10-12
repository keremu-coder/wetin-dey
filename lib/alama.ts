export type AlamaRarity = "common" | "uncommon" | "rare" | "legendary";

export type Alama = {
  skin: number;
  attire: number;
  headwear: number;
  expression: number;
  accessory: number;
  aura: number;
  bg: number;
  skinColor: string;
  attireColor: string;
  headwearColor: string;
  bgColor: string;
  bgColor2: string;
  accessoryColor: string;
  auraColor: string;
  rarity: AlamaRarity;
};

// Five Nigerian skin tones, light to deep.
const SKIN_COLORS = ["#E8B88A", "#C68642", "#8D5524", "#5C3317", "#3D2817"];

// Cloth palette — leaf, adire, zobo, clay, plum, lagoon.
const CLOTH_COLORS = ["#0A6B43", "#2B4A9E", "#A3203A", "#A8501F", "#6A2E73", "#0F6A73"];

// Background gradient pairs.
const BG_COLORS: [string, string][] = [
  ["#0E0E0E", "#1F1F1F"], // obsidian
  ["#0A1F14", "#124028"], // deep leaf
  ["#0F1A33", "#1B3060"], // deep adire
  ["#2A0A10", "#4A1A24"], // deep zobo
  ["#F0E8D8", "#DDD0B0"], // warm cream
  ["#1C0E24", "#331D42"]  // deep plum
];

const GOLD = "#D4AF37";
const BRONZE = "#B87333";

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

  const skin = h % 5;
  const attire = (h >>> 3) % 3;
  const headwearRoll = (h >>> 6) % 4;
  const expression = (h >>> 9) % 3;
  const accessory = (h >>> 12) % 4;
  const bg = (h >>> 15) % 6;

  // Rarity band. Not a lottery — composition-based.
  // Legendary only fires when the geometry cooperates (crown + full aura).
  const roll = (h >>> 20) % 1000;
  let rarity: AlamaRarity;
  let aura: number;
  if (roll < 15) {
    rarity = "legendary";
    aura = 3;
  } else if (roll < 90) {
    rarity = "rare";
    aura = 2;
  } else if (roll < 280) {
    rarity = "uncommon";
    aura = 1;
  } else {
    rarity = "common";
    aura = 0;
  }

  const finalHeadwear = rarity === "legendary" ? 3 : headwearRoll;

  const skinColor = SKIN_COLORS[skin];
  const attireColor = CLOTH_COLORS[(h >>> 22) % 6];
  const headwearColor = finalHeadwear === 3 ? GOLD : CLOTH_COLORS[(h >>> 25) % 6];
  const [bgColor, bgColor2] = BG_COLORS[bg];
  const accessoryColor = rarity === "common" ? "#E0D5BD" : GOLD;
  const auraColor = aura === 0 ? "transparent" : aura === 1 ? BRONZE : GOLD;

  return {
    skin, attire, headwear: finalHeadwear, expression, accessory, aura, bg,
    skinColor, attireColor, headwearColor, bgColor, bgColor2, accessoryColor, auraColor,
    rarity
  };
}

// SVG shape data — all drawn on a 100x100 viewBox.

// Shoulders. Attire covers the neck and lower chest.
export const ATTIRE_PATH: Record<number, string> = {
  0: "M14 100 Q14 70 50 70 Q86 70 86 100 Z",               // Agbada — wide draped
  1: "M22 100 Q22 76 50 76 Q78 76 78 100 Z",               // Kaftan — straight collar
  2: "M18 100 Q18 74 50 74 Q82 74 82 100 Z"                // Buba — soft rounded
};

// Headwear. Sits above the head (head top is around y=22).
export const HEADWEAR_PATH: Record<number, string> = {
  0: "M31 27 L69 27 L68 30 L32 30 Z",                       // Bare — subtle headband
  1: "M28 28 Q26 6 50 6 Q74 6 72 28 Q72 30 68 30 L32 30 Q28 30 28 28 Z", // Gele
  2: "M31 27 Q31 12 50 12 Q69 12 69 27 Z",                  // Fila
  3: "M30 27 L36 13 L42 20 L50 8 L58 20 L64 13 L70 27 Z"    // Crown
};

export const RARITY_LABEL: Record<AlamaRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary"
};