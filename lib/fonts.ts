// Self-hosted fonts via next/font. At build time Next.js downloads each
// font, hashes it, and serves it from /_next/static/media. No runtime
// request to fonts.googleapis.com.
//
// Every font exposes a CSS variable that lib/bbm-fonts.ts and
// tailwind.config.ts reference.

import {
  Figtree,
  Bricolage_Grotesque,
  Fraunces,
  JetBrains_Mono,
  Caveat,
  Pacifico,
  Permanent_Marker,
  Bebas_Neue,
  Playfair_Display
} from "next/font/google";

export const inter = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap"
});

export const spaceGrotesk = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-space-grotesk",
  display: "swap"
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap"
});

export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caveat",
  display: "swap"
});

export const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
  display: "swap"
});

export const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-permanent-marker",
  display: "swap"
});

export const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas-neue",
  display: "swap"
});

export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-playfair-display",
  display: "swap"
});

/**
 * All font variables concatenated. Apply this to <body> so every
 * descendant can reference var(--font-*) in inline styles.
 */
export const FONT_VARIABLE_CLASSES = [
  inter.variable,
  spaceGrotesk.variable,
  jetbrainsMono.variable,
  caveat.variable,
  pacifico.variable,
  permanentMarker.variable,
  bebasNeue.variable,
  playfairDisplay.variable
].join(" ");
