// Self-hosted fonts via next/font. At build time Next.js downloads each
// font, hashes it, and serves it from /_next/static/media. No runtime
// request to fonts.googleapis.com.
//
// latin-ext is required on Figtree and Fraunces so Yoruba (ọ ẹ ṣ) and
// Igbo (ị ụ) dot-below letters render from the font itself instead of
// falling back to system fonts. The five decorative fonts only ship
// when a user explicitly picks them in Message font settings, so they
// are preload:false to keep every other page lighter.

import {
  Figtree,
  Fraunces,
  JetBrains_Mono,
  Caveat,
  Pacifico,
  Permanent_Marker,
  Bebas_Neue,
  Playfair_Display
} from "next/font/google";

// Figtree — body text. Exposes --font-inter for back-compat with
// existing class names (font-sans).
export const inter = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap"
});

// Fraunces — display serif. Exposes --font-space-grotesk for back-compat
// with existing class names (font-serif, font-display).
export const spaceGrotesk = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-space-grotesk",
  display: "swap"
});

// JetBrains Mono — used only for report refs and recovery codes.
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  preload: false,
  display: "swap"
});

// Five decorative fonts. Only loaded when a user picks them in
// Message font settings, so they are not preloaded.
export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caveat",
  preload: false,
  display: "swap"
});

export const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
  preload: false,
  display: "swap"
});

export const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-permanent-marker",
  preload: false,
  display: "swap"
});

export const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas-neue",
  preload: false,
  display: "swap"
});

export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-playfair-display",
  preload: false,
  display: "swap"
});

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