import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--color-paper)",
        surface: "var(--color-surface)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        faint: "var(--color-faint)",
        accent: {
          DEFAULT: "var(--color-accent)",
          soft: "var(--color-accent-soft)",
          deep: "var(--color-accent-deep)"
        },
        warm: {
          DEFAULT: "var(--color-accent)",
          soft: "var(--color-accent-soft)",
          deep: "var(--color-accent-deep)"
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          soft: "var(--color-danger-soft)"
        },
        gold: {
          DEFAULT: "var(--color-gold)",
          soft: "var(--color-gold-soft)"
        },
        surface2: "var(--color-surface-2)",
        surface3: "var(--color-surface-3)",
        warn: {
          DEFAULT: "var(--color-warn)",
          tint: "var(--color-warn-tint)",
          ink: "var(--color-warn-ink)"
        },
        primary: {
          DEFAULT: "var(--color-accent)",
          tint: "var(--color-primary-tint)",
          ink: "var(--color-primary-ink)"
        },
        dangerInk: "var(--color-danger-ink)",
        dangerTint: "var(--color-danger-tint)",
        leaf: "var(--color-leaf)",
        danfo: "var(--color-danfo)",
        zobo: "var(--color-zobo)",
        adire: "var(--color-adire)",
        clay: "var(--color-clay)",
        plum: "var(--color-plum)",
        lagoon: "var(--color-lagoon)",
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)"
        }
      },
      fontFamily: {
        // "serif" aliased to Space Grotesk so existing class names work.
        // Variables are declared on <body> by lib/fonts.ts via next/font.
        serif: [
          "var(--font-space-grotesk)",
          "system-ui",
          "sans-serif"
        ],
        display: [
          "var(--font-space-grotesk)",
          "system-ui",
          "sans-serif"
        ],
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "Menlo",
          "monospace"
        ]
      },
      borderRadius: {
        xl: "8px",
        "2xl": "12px",
        "3xl": "16px"
      }
    }
  },
  plugins: []
};

export default config;