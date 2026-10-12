// lib/text-colors.ts
// Text color registry — mirrors lib/fonts-registry.ts.
// Colors use the v3 Nigerian palette so nothing clashes.
// Each color has a light and dark hex; rendering uses CSS
// variables so theme switches are automatic.

export type TextColor = {
  id: string;
  label: string;
  swatch: { light: string; dark: string };
};

export const DEFAULT_TEXT_COLOR_ID = "ink";

export const TEXT_COLORS: TextColor[] = [
  { id: "ink",    label: "Ink",    swatch: { light: "#14201A", dark: "#EDF2EE" } },
  { id: "leaf",   label: "Leaf",   swatch: { light: "#0A6B43", dark: "#4CCB8E" } },
  { id: "adire",  label: "Adire",  swatch: { light: "#2B4A9E", dark: "#7EA6FF" } },
  { id: "zobo",   label: "Zobo",   swatch: { light: "#A3203A", dark: "#FF8A98" } },
  { id: "clay",   label: "Clay",   swatch: { light: "#A8501F", dark: "#E89056" } },
  { id: "plum",   label: "Plum",   swatch: { light: "#6A2E73", dark: "#C287CB" } },
  { id: "lagoon", label: "Lagoon", swatch: { light: "#0F6A73", dark: "#4DB8C0" } },
  { id: "gold",   label: "Gold",   swatch: { light: "#7A5200", dark: "#F7D26B" } }
];

const MAP: Record<string, TextColor> = Object.fromEntries(
  TEXT_COLORS.map((c) => [c.id, c])
);

export function getTextColor(id: string | null | undefined): TextColor {
  if (!id) return MAP[DEFAULT_TEXT_COLOR_ID];
  return MAP[id] ?? MAP[DEFAULT_TEXT_COLOR_ID];
}

export function isValidTextColorId(id: unknown): id is string {
  return typeof id === "string" && id in MAP;
}