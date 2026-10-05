"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("wetindey_theme") as Theme) || "system";
    setTheme(saved);
  }, []);

  function change(next: Theme) {
    setTheme(next);
    localStorage.setItem("wetindey_theme", next);
    applyTheme(next);
  }

  if (!mounted) return null;

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "☀️" },
    { value: "dark", label: "Dark", icon: "🌙" },
    { value: "system", label: "Auto", icon: "🖥️" }
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl bg-ink/5 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => change(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[0.75rem] font-medium transition-all ${
            theme === o.value
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
          aria-label={`Switch to ${o.label} theme`}
        >
          <span>{o.icon}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}