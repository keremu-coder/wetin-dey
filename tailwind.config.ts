import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#000000",
        surface: "#0a0a0a",
        ink: "#f4f4f5",
        muted: "#a1a1aa",
        faint: "#52525b",
        accent: {
          DEFAULT: "#10b981",
          soft: "#052e1f",
          deep: "#34d399"
        },
        warm: {
          DEFAULT: "#f59e0b",
          soft: "#2a1f0a",
          deep: "#fbbf24"
        },
        danger: {
          DEFAULT: "#ef4444",
          soft: "#2a0e0e"
        },
        gold: {
          DEFAULT: "#eab308",
          soft: "#2a1f0a"
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.16)"
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
        card: "0 1px 2px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4)",
        button: "0 1px 2px rgba(0,0,0,0.5)",
        nav: "0 1px 0 rgba(255,255,255,0.06)"
      }
    }
  },
  plugins: []
};

export default config;