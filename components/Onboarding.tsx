"use client";

import { useEffect, useState } from "react";
import { WetinMark } from "./WetinMark";

const STORAGE_KEY = "wetindey:onboarded:v1";

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeen = localStorage.getItem(STORAGE_KEY);
      if (!hasSeen) setShow(true);
    }
  }, []);

  if (!show) return null;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const slides = [
    {
      title: "Welcome to Wetin Dey",
      body: "Our country, but on the internet. A safe place to talk about what is happening in Nigeria, without fear.",
      icon: (
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-brand-tint">
          <span style={{ color: "var(--brand-ink)" }}>
            <WetinMark size={72} title="" />
          </span>
        </div>
      ),
    },
    {
      title: "Report safely (Talk Am)",
      body: "See something wrong? Report it with evidence. No phone number needed. Your identity stays hidden.",
      icon: (
        <div className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-3xl bg-brand-tint px-5">
          <span className="h-2 w-full rounded-full bg-brand" />
          <span className="h-2 w-4/5 self-start rounded-full bg-brand/60" />
          <span className="h-2 w-3/5 self-start rounded-full bg-brand/35" />
        </div>
      ),
    },
    {
      title: "Play and Connect",
      body: "Join Voice Rooms, talk with your community, and play our classic home games like Whot.",
      icon: (
        <div className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-3xl bg-brand-tint">
          <span className="text-4xl">🎴</span>
          <span className="text-[1.2rem] font-bold text-brand">Whot!</span>
        </div>
      ),
    },
    {
      title: "Stay safe with Radar",
      body: "Going somewhere risky? Turn on Radar to share a temporary, private location signal with your trusted contacts.",
      icon: (
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-brand-tint">
          <span className="text-5xl">📍</span>
        </div>
      ),
    },
    {
      title: "Need bigger text?",
      body: "If reading is hard, turn on Easy Mode in Settings. It makes all text 20% larger across the whole app.",
      icon: (
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-brand-tint">
          <span className="text-5xl">🔍</span>
        </div>
      ),
    },
  ];

  const current = slides[step];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a] text-white p-6 sm:p-10">
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto w-full">
        <div className="mb-8">{current.icon}</div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 font-serif">{current.title}</h2>
        <p className="text-lg sm:text-xl text-white/70 leading-relaxed mb-12">
          {current.body}
        </p>
      </div>

      <div className="max-w-md mx-auto w-full pb-8">
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className={"h-2 rounded-full transition-all " + (i === step ? "w-8 bg-brand" : "w-2 bg-white/20")}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {step < slides.length - 1 ? (
            <>
              <button
                onClick={() => setStep(step + 1)}
                className="w-full rounded-2xl bg-brand py-4 text-lg font-bold text-white transition-transform active:scale-95"
              >
                Next
              </button>
              <button
                onClick={finish}
                className="w-full rounded-2xl py-3 text-base font-semibold text-white/50 hover:text-white"
              >
                Skip
              </button>
            </>
          ) : (
            <button
              onClick={finish}
              className="w-full rounded-2xl bg-brand py-4 text-lg font-bold text-white transition-transform active:scale-95"
            >
              Start using Wetin Dey
            </button>
          )}
        </div>
      </div>
    </div>
  );
}