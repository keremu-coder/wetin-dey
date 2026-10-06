"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BBM_FONTS, DEFAULT_FONT_ID, getFontById } from "@/lib/bbm-fonts";
import { vibrate } from "@/lib/bbm-sound";

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
        if (!d?.id) {
          setLoading(false);
          return;
        }
        setSessionId(d.id);
        try {
          const r = await fetch(
            `/api/settings/font?session_id=${encodeURIComponent(d.id)}`
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
        if (!cancelled) setLoading(false);
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
    vibrate(20);

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
      vibrate(30);
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
        className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
      >
        ← Settings
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Your font
        </h1>
        <p className="mt-1 text-[0.875rem] text-muted">
          Pick the font your messages show up in — for everyone who reads them.
          Like BBM.
        </p>
      </header>

      {/* Live preview input */}
      <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <label className="mb-2 block font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          Try it out
        </label>
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value.slice(0, 60))}
          placeholder="Type something…"
          maxLength={60}
        />
        <p className="mt-3 mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
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

      {/* Font grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BBM_FONTS.map((font) => {
          const selected = font.id === currentFont;
          const isSaving = saving === font.id;
          const justSaved = saved === font.id;

          return (
            <button
              key={font.id}
              type="button"
              onClick={() => pick(font.id)}
              disabled={loading || isSaving}
              className={`font-card ${selected ? "selected" : ""}`}
            >
              <p
                className="font-card-sample"
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
                <p className="font-card-label">{font.label}</p>
                {justSaved ? (
                  <span className="font-card-check">✓ Saved</span>
                ) : selected ? (
                  <span className="font-card-check">✓ Selected</span>
                ) : isSaving ? (
                  <span className="font-card-label">Saving…</span>
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