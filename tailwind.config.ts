import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAF7F2",      // warm cream background
        surface: "#FFFFFF",     // cards
        ink: "#1A1612",         // deep brown-black text
        muted: "#6B6459",       // warm gray for meta
        faint: "#A39B8C",       // very muted
        accent: {
          DEFAULT: "#1F7A4D",   // Nigeria green
          soft: "#E8F3EC",
          deep: "#15522F"
        },
        warm: {
          DEFAULT: "#D97706",   // terracotta — CTAs
          soft: "#FDF3E7",
          deep: "#A15A05"
        },
        danger: {
          DEFAULT: "#C0392B",
          soft: "#FBEAE8"
        },
        gold: {
          DEFAULT: "#C7A008",
          soft: "#FBF3D9"
        },
        border: {
          DEFAULT: "rgba(26, 22, 18, 0.08)",
          strong: "rgba(26, 22, 18, 0.16)"
        }
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"]
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(26, 22, 18, 0.04), 0 2px 8px rgba(26, 22, 18, 0.04)",
        "card-hover": "0 4px 12px rgba(26, 22, 18, 0.08), 0 8px 24px rgba(26, 22, 18, 0.06)",
        button: "0 1px 2px rgba(26, 22, 18, 0.08)",
        nav: "0 1px 0 rgba(26, 22, 18, 0.06)"
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "pulse-soft": "pulse-soft 1.5s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;