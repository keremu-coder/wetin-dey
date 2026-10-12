"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FONTS, DEFAULT_FONT_ID, getFontById } from "@/lib/fonts-registry";

export default function FontSettingsPage() {
  const [currentFont, setCurrentFont] = useState<string>(DEFAULT_FONT_ID);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState("Wetin dey happen?");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        if (cancelled) return;
        const id: string | null =
          d?.id ?? d?.session_id ?? d?.sessionId ?? null;
        if (!id) {
          setLoading(false);
          setError("Could not load your session. Reload the page.");
          return;
        }
        setSessionId(id);
        try {
          const r = await fetch(
            `/api/settings/font?session_id=${encodeURIComponent(id)}`
          );
          if (r.ok) {
            const j = await r.json();
            if (!cancelled && typeof j?.font === "string") {
              setCurrentFont(j.font);
            }
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError("Could not load your session.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pick(fontId: string) {
    if (!sessionId) {
      setError("Still loading your session…");
      return;
    }
    if (fontId === currentFont) return;

    setSaving(fontId);
    setError("");

    try {
      const res = await fetch("/api/settings/font", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, font: fontId })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        setSaving(null);
        return;
      }
      setCurrentFont(fontId);
      setSaved(fontId);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          (navigator as Navigator & { vibrate: (p: number) => void }).vibrate(
            25
          );
        } catch {
          /* ignore */
        }
      }
      setTimeout(() => setSaved(null), 1400);
    } catch {
      setError("Network error");
    } finally {
      setSaving(null);
    }
  }

  const activeFont = getFontById(currentFont);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <Link
        href="/settings"
        className="text-[0.7rem] text-faint hover:text-brand"
      >
        ← Settings
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Your font
        </h1>
        <p className="mt-1 text-[0.875rem] text-muted">
          Pick the font your messages show up in — for everyone who reads them.
         
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <label className="mb-2 block text-[0.65rem] text-faint">
          Try it out
        </label>
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value.slice(0, 60))}
          placeholder="Type something…"
          maxLength={60}
        />
        <p className="mt-3 mb-1 text-[0.65rem] text-faint">
          Preview
        </p>
        <p
          className="break-words leading-[1.35] text-ink"
          style={{
            fontFamily: activeFont.family,
            fontSize: activeFont.sizeAdjust
              ? `calc(1rem * ${activeFont.sizeAdjust})`
              : "1rem"
          }}
        >
          {previewText || "Wetin dey happen?"}
        </p>
      </section>

      {error ? (
        <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FONTS.map((font) => {
          const selected = font.id === currentFont;
          const isSaving = saving === font.id;
          const justSaved = saved === font.id;

          return (
            <button
              key={font.id}
              type="button"
              onClick={() => pick(font.id)}
              disabled={loading || isSaving}
              className={`card flex flex-col gap-2 p-4 text-left transition-colors ${
                selected
                  ? "!border-brand"
                  : "hover:!border-border-strong"
              }`}
            >
              <p
                className="m-0 break-words leading-[1.25] text-ink"
                style={{
                  fontFamily: font.family,
                  fontSize: font.sizeAdjust
                    ? `calc(1rem * ${font.sizeAdjust})`
                    : "1rem"
                }}
              >
                {font.sample}
              </p>
              <div className="flex items-center justify-between">
                <p className="m-0 text-[0.6875rem] text-muted">
                  {font.label}
                </p>
                {justSaved ? (
                  <span className="text-[0.6875rem] font-medium text-brand">
                    ✓ Saved
                  </span>
                ) : selected ? (
                  <span className="text-[0.6875rem] font-medium text-brand">
                    ✓ Selected
                  </span>
                ) : isSaving ? (
                  <span className="text-[0.6875rem] text-faint">
                    Saving…
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[0.75rem] text-faint">
        Same font applies to chat, DMs, and comments. Voice notes and reactions
        stay neutral.
      </p>
    </main>
  );
}