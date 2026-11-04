"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wetindey_age_ack";
const ACK_VALUE = "17+";

/**
 * AgeGate
 *
 * Blocking 17+ confirmation. Required for Apple 1.2 (UGC age rating)
 * and Google Play's content rating requirement. Shown once per browser:
 * after acknowledgment, the localStorage flag suppresses it.
 *
 * Renders above everything else (z-[200]). No dismiss — user must pick
 * a button. If they decline, the app is unreachable in this session.
 */
export function AgeGate() {
  const [state, setState] = useState<"checking" | "ask" | "ok" | "denied">(
    "checking"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      setState(seen === ACK_VALUE ? "ok" : "ask");
    } catch {
      setState("ask");
    }
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, ACK_VALUE);
    } catch {
      /* localStorage may be disabled — allow session-only pass */
    }
    setState("ok");
  }

  function decline() {
    setState("denied");
  }

  if (state === "checking" || state === "ok") return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agegate-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        {state === "denied" ? (
          <>
            <div className="text-center text-[3rem] leading-none">🔞</div>
            <h1
              id="agegate-title"
              className="mt-4 text-center font-serif text-[1.4rem] font-semibold text-ink"
            >
              Wetin Dey is 17+
            </h1>
            <p className="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted">
              This app carries user-generated content including reports
              about public services and community chat. It is not
              suitable for people under 17.
            </p>
            <p className="mt-3 text-center text-[0.8125rem] text-muted">
              Come back when you are older.
            </p>
          </>
        ) : (
          <>
            <div className="text-center text-[3rem] leading-none">🛡️</div>
            <h1
              id="agegate-title"
              className="mt-4 text-center font-serif text-[1.4rem] font-semibold text-ink"
            >
              Are you 17 or older?
            </h1>
            <p className="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted">
              Wetin Dey contains user-generated reports, community
              discussions, and live chat. You must be 17 or older to
              continue.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={accept}
                className="w-full rounded-full bg-brand px-4 py-3 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-brand-soft"
              >
                Yes, I am 17 or older
              </button>
              <button
                type="button"
                onClick={decline}
                className="w-full rounded-full border border-border px-4 py-3 text-[0.9375rem] font-medium text-muted transition-colors hover:bg-ink/5"
              >
                No, I am under 17
              </button>
            </div>
            <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-faint">
              By continuing, you confirm the information above is accurate.
            </p>
          </>
        )}
      </div>
    </div>
  );
}