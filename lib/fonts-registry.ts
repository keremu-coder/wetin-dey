// lib/bbm-fonts.ts
// BBM-style font registry. Every user picks one font.
// Their messages render in that font for everyone who reads them.
//
// Each font's `family` value references a CSS variable declared by
// lib/fonts.ts (via next/font). The fallback chain still works if the
// variable somehow isn't defined.

export type BbmFont = {
  id: string;
  label: string;
  family: string;
  sample: string;
  sizeAdjust?: number;
  isCursive?: boolean;
};

export const DEFAULT_FONT_ID = "inter";

export const BBM_FONTS: BbmFont[] = [
  {
    id: "inter",
    label: "Inter",
    family: "var(--font-inter), system-ui, -apple-system, sans-serif",
    sample: "Wetin dey happen?"
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    family: "var(--font-space-grotesk), system-ui, sans-serif",
    sample: "Wetin dey happen?"
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    family: "var(--font-jetbrains-mono), Menlo, monospace",
    sample: "Wetin dey happen?"
  },
  {
    id: "caveat",
    label: "Caveat",
    family: "var(--font-caveat), 'Comic Sans MS', cursive",
    sample: "Wetin dey happen?",
    sizeAdjust: 1.35,
    isCursive: true
  },
  {
    id: "pacifico",
    label: "Pacifico",
    family: "var(--font-pacifico), cursive",
    sample: "Wetin dey happen?",
    sizeAdjust: 1.15,
    isCursive: true
  },
  {
    id: "permanent-marker",
    label: "Permanent Marker",
    family: "var(--font-permanent-marker), cursive",
    sample: "Wetin dey happen?",
    sizeAdjust: 1.1,
    isCursive: true
  },
  {
    id: "bebas-neue",
    label: "Bebas Neue",
    family: "var(--font-bebas-neue), Impact, sans-serif",
    sample: "WETIN DEY HAPPEN?",
    sizeAdjust: 1.2
  },
  {
    id: "playfair-display",
    label: "Playfair Display",
    family: "var(--font-playfair-display), Georgia, serif",
    sample: "Wetin dey happen?"
  }
];

const FONT_MAP: Record<string, BbmFont> = Object.fromEntries(
  BBM_FONTS.map((f) => [f.id, f])
);

export function getFontById(id: string | null | undefined): BbmFont {
  if (!id) return FONT_MAP[DEFAULT_FONT_ID];
  return FONT_MAP[id] ?? FONT_MAP[DEFAULT_FONT_ID];
}

export function isValidFontId(id: unknown): id is string {
  return typeof id === "string" && id in FONT_MAP;
}