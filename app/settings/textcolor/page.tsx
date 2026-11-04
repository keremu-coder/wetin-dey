"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEXT_COLORS, DEFAULT_TEXT_COLOR_ID } from "@/lib/text-colors";

export default function TextColorSettingsPage() {
  const [currentColor, setCurrentColor] = useState<string>(DEFAULT_TEXT_COLOR_ID);
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
        const id: string | null = d?.id ?? d?.session_id ?? d?.sessionId ?? null;
        if (!id) {
          setLoading(false);
          setError("Could not load your session. Reload the page.");
          return;
        }
        setSessionId(id);
        try {
          const r = await fetch(`/api/settings/textcolor?session_id=${encodeURIComponent(id)}`);
          if (r.ok) {
            const j = await r.json();
            if (!cancelled && typeof j?.color === "string") setCurrentColor(j.color);
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

  async function pick(colorId: string) {
    if (!sessionId) {
      setError("Still loading your session...");
      return;
    }
    if (colorId === currentColor) return;
    setSaving(colorId);
    setError("");
    try {
      const res = await fetch("/api/settings/textcolor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color: colorId })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        setSaving(null);
        return;
      }
      setCurrentColor(colorId);
      setSaved(colorId);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          (navigator as Navigator & { vibrate: (p: number) => void }).vibrate(25);
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

  const active = TEXT_COLORS.find((c) => c.id === currentColor) ?? TEXT_COLORS[0];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <Link
        href="/settings"
        className="text-[0.8125rem] font-medium text-faint hover:text-primary-ink"
      >
        Back to settings
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Your text color</h1>
        <p className="mt-1 text-[0.875rem] text-muted">
          Pick the color your messages show up in, for everyone who reads them.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <label className="mb-2 block text-[0.8125rem] font-medium text-faint">
          Try it out
        </label>
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value.slice(0, 60))}
          placeholder="Type something..."
          maxLength={60}
        />
        <p className="mt-3 mb-1 text-[0.8125rem] font-medium text-faint">Preview</p>
        <p
          className="break-words leading-[1.35]"
          style={{
            color: `var(--tc-${active.id}-light)`,
            fontSize: "1rem"
          }}
        >
          {previewText || "Wetin dey happen?"}
        </p>
      </section>

      {error ? (
        <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{error}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TEXT_COLORS.map((color) => {
          const selected = color.id === currentColor;
          const isSaving = saving === color.id;
          const justSaved = saved === color.id;
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => pick(color.id)}
              disabled={loading || isSaving}
              className={`flex flex-col items-center gap-2 rounded-2xl border bg-surface p-4 transition-colors ${
                selected ? "!border-primary" : "border-border hover:border-border-strong"
              }`}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-[1.25rem] font-bold"
                style={{ background: color.swatch.light, color: "#fff" }}
              >
                Aa
              </span>
              <span className="text-[0.8125rem] font-semibold text-ink">{color.label}</span>
              {justSaved ? (
                <span className="text-[0.6875rem] font-medium text-primary-ink">Saved</span>
              ) : selected ? (
                <span className="text-[0.6875rem] font-medium text-primary-ink">Selected</span>
              ) : isSaving ? (
                <span className="text-[0.6875rem] text-faint">Saving...</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[0.75rem] text-faint">
        Same color applies to chat, DMs, and comments.
      </p>
    </main>
  );
}