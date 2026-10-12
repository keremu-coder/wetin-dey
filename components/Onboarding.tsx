"use client";

import { useEffect, useState } from "react";
import { WetinMark } from "./WetinMark";

const STORAGE_KEY = "wetindey:onboarded:v1";

type Slide = {
  render: () => React.ReactNode;
  title: string;
  body: string;
  accent: string;
};

/**
 * First-run onboarding. Four slides, one per product surface.
 * Uses the Wetin mark as the hero art on slide 1 and simple flat
 * compositions on the rest — no emoji-as-illustration.
 */

function IntroArt() {
  return (
    <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-brand-tint">
      <span style={{ color: "var(--brand-ink)" }}>
        <WetinMark size={72} title="" />
      </span>
    </div>
  );
}

function TalkAmArt() {
  return (
    <div className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-3xl bg-brand-tint px-4">
      <span className="h-1.5 w-full rounded-full bg-brand" />
      <span className="h-1.5 w-3/4 self-start rounded-full bg-brand/60" />
      <span className="h-1.5 w-1/2 self-start rounded-full bg-brand/35" />
    </div>
  );
}

function SpacesArt() {
  return (
    <div className="flex h-32 w-32 flex-col justify-center gap-2 rounded-3xl bg-brand-tint px-4">
      <span className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zobo text-[0.65rem] font-bold text-white">
          A
        </span>
        <span className="h-1.5 flex-1 rounded-full bg-brand/55" />
      </span>
      <span className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-adire text-[0.65rem] font-bold text-white">
          B
        </span>
        <span className="h-1.5 flex-1 rounded-full bg-brand/35" />
      </span>
      <span className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-[0.65rem] font-bold text-white">
          C
        </span>
        <span className="h-1.5 flex-1 rounded-full bg-brand/55" />
      </span>
    </div>
  );
}

function RadarArt() {
  return (
    <div className="relative flex h-32 w-32 items-center justify-center rounded-3xl bg-brand-tint">
      <span className="absolute h-24 w-24 rounded-full border-2 border-brand/20" />
      <span className="absolute h-16 w-16 rounded-full border-2 border-brand/35" />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[1.1rem] text-white">
        !
      </span>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    render: () => <IntroArt />,
    title: "Wetin dey happen?",
    body: "Talk about wetin dey vex you. Gather your people. Know say your family dey safe. Wetin Dey na the app for Nigerian life.",
    accent: "Voice first - No phone number - Made in Nigeria"
  },
  {
    render: () => <TalkAmArt />,
    title: "Talk Am — report what you see",
    body: "NEPA overbilling. Police extortion. Broken services. Post with evidence, no name, no phone number. Every report gets a permanent link nobody can delete.",
    accent: "Anonymous - Evidence - Never deleted"
  },
  {
    render: () => <SpacesArt />,
    title: "Spaces — for your people",
    body: "Family group, church cell, estate security, old-classmates. Invite with a link, chat with voice or text. This is where Nigerian life actually happens.",
    accent: "Voice notes - Group chat - Invite by link"
  },
  {
    render: () => <RadarArt />,
    title: "Radar — a quiet signal",
    body: "When you reach home safe, or when you need help. Send one private signal to your Circle. It reaches them like a call, with live location if you need it. Stop sharing the moment you tap I'm safe.",
    accent: "Private signals - Live location - Stop anytime"
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
        className="absolute right-4 z-10 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
        style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      >
        Skip
      </button>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {slide.render()}
        <h1 className="mt-8 max-w-md font-serif text-[1.75rem] font-semibold leading-tight text-ink">
          {slide.title}
        </h1>
        <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-muted">
          {slide.body}
        </p>
        <p className="mt-6 text-[0.8125rem] font-medium text-brand">
          {slide.accent}
        </p>
      </div>

      <div className="px-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        <div className="mb-6 flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-brand" : "w-1.5 bg-ink/15"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          className="w-full rounded-2xl bg-brand py-4 font-serif text-[1.05rem] font-semibold text-white transition-colors hover:bg-brand-soft"
        >
          {isLast ? "Enter Wetin Dey" : "Next"}
        </button>
      </div>
    </div>
  );
}