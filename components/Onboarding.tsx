"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wetindey:onboarded:v1";

type Slide = {
  icon: string;
  title: string;
  body: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    icon: "📢",
    title: "Talk Am — report what you see",
    body: "NEPA overbilling. Police extortion. Broken services. Post it with evidence, no name, no phone number. Every report gets a permanent link nobody can delete.",
    accent: "Anonymous · Evidence required · Never deleted"
  },
  {
    icon: "👥",
    title: "Spaces — for your people",
    body: "Family group, church cell, estate security, old-classmates. Invite with a link, chat with voice or text, see status lines like  This is where Nigerian life actually happens.",
    accent: "Voice-first · Group chat · Invite by link"
  },
  {
    icon: "🔔",
    title: "Never miss a reply",
    body: "Someone mentions you, replies to your report, or comments on your post — you'll know. Tap the bell to pick up where you left off.",
    accent: "Replies · Mentions · Comments"
  }
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  function next() {
    if (index < SLIDES.length - 1) setIndex(index + 1);
    else finish();
  }

  if (!show) return null;

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-paper">
      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-4 z-10 rounded-full px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-faint transition-colors hover:text-ink"
        style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      >
        Skip
      </button>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="text-[5rem] leading-none">{slide.icon}</div>
        <h1 className="mt-8 max-w-md font-serif text-[1.75rem] font-semibold leading-tight text-ink">
          {slide.title}
        </h1>
        <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-muted">
          {slide.body}
        </p>
        <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-wider text-accent">
          {slide.accent}
        </p>
      </div>

      <div className="px-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        <div className="mb-6 flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-accent" : "w-1.5 bg-ink/15"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          className="w-full rounded-2xl bg-accent py-4 font-serif text-[1.05rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          {isLast ? "Enter Wetin Dey" : "Next"}
        </button>
      </div>
    </div>
  );
}