"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SIGNALS,
  getSignal,
  signalAge,
  approxKm,
  unbucketCoord,
  type Signal
} from "@/lib/radar";

type SignalRow = {
  id: string;
  signal_type: string;
  lat_bucket: number;
  lng_bucket: number;
  note: string | null;
  created_at: string;
};

type Coords = { lat: number; lng: number };

export function LiveRadarPanel() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoState, setGeoState] = useState<
    "idle" | "locating" | "granted" | "denied" | "error"
  >("idle");
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("error");
      setError("Your browser no support location.");
      return;
    }
    setGeoState("locating");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGeoState("granted");
      },
      () => {
        setGeoState("denied");
        setError(
          "We need your location to show what's happening around you. Enable location in your browser settings."
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  const fetchSignals = useCallback(async (c: Coords) => {
    setSignalsLoading(true);
    try {
      const res = await fetch(
        `/api/radar?lat=${c.lat}&lng=${c.lng}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (res.ok && json?.signals) {
        setSignals(json.signals as SignalRow[]);
      }
    } catch {
      /* silent */
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    void fetchSignals(coords);
    refreshRef.current = setInterval(() => {
      void fetchSignals(coords);
    }, 60000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [coords, fetchSignals]);

  async function submitSignal(signal: Signal) {
    if (!coords || submitting) return;
    setSubmitting(signal.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/radar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signal_type: signal.id,
          lat: coords.lat,
          lng: coords.lng
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Signal no send");
        return;
      }
      setMessage(`Signal sent — ${signal.label}.`);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(25);
        } catch {
          /* ignore */
        }
      }
      void fetchSignals(coords);
      setTimeout(() => setMessage(""), 2200);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(null);
    }
  }

  const recentCounts = new Map<string, number>();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const s of signals) {
    const t = new Date(s.created_at).getTime();
    if (t < oneHourAgo) continue;
    recentCounts.set(s.signal_type, (recentCounts.get(s.signal_type) ?? 0) + 1);
  }

  if (geoState === "idle") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <div className="text-[2.5rem]">📍</div>
        <p className="mt-3 font-serif text-[1.1rem] font-semibold text-ink">
          See what&apos;s happening near you
        </p>
        <p className="mt-1 text-[0.875rem] text-muted">
          We only use your location rounded to about 1 km. Nothing precise is
          stored.
        </p>
        <button
          type="button"
          onClick={requestLocation}
          className="mt-5 rounded-2xl bg-accent px-6 py-3 font-serif text-[1rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Turn on my location
        </button>
      </div>
    );
  }

  if (geoState === "locating") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <div className="text-[2.5rem] animate-pulse">📍</div>
        <p className="mt-3 text-[0.9375rem] text-muted">Finding you…</p>
      </div>
    );
  }

  if (geoState === "denied" || geoState === "error") {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-soft p-6">
        <p className="font-serif text-[1.05rem] font-semibold text-danger">
          Location blocked
        </p>
        <p className="mt-1 text-[0.875rem] text-ink">
          {error || "Enable location in your browser settings, then reload."}
        </p>
        <button
          type="button"
          onClick={requestLocation}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          Tap to signal what you&apos;re seeing
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SIGNALS.map((s) => {
            const count = recentCounts.get(s.id) ?? 0;
            const busy = submitting === s.id;
            const toneClasses =
              s.tone === "positive"
                ? "border-accent/30 bg-accent-soft hover:border-accent"
                : s.tone === "negative"
                  ? "border-danger/30 bg-danger-soft hover:border-danger"
                  : "border-gold/30 bg-gold-soft hover:border-gold";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => submitSignal(s)}
                disabled={!!submitting}
                className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition-colors disabled:opacity-60 ${toneClasses}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-[1.65rem] leading-none">{s.emoji}</span>
                  {count > 0 ? (
                    <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-ink">
                      {count}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[0.875rem] font-semibold text-ink">
                  {busy ? "Sending…" : s.label}
                </p>
                <p className="text-[0.7rem] leading-snug text-muted">
                  {s.hint}
                </p>
              </button>
            );
          })}
        </div>

        {message ? (
          <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-center text-[0.8125rem] font-medium text-accent-deep">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-center text-[0.8125rem] text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          Around you, last 3 hours
        </p>
        {signalsLoading ? (
          <span className="text-[0.7rem] text-faint">Refreshing…</span>
        ) : null}
      </div>

      {signals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <p className="empty-state-title">Nothing yet near you</p>
          <p className="empty-state-text">
            Be the first to signal. Tap a button above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((s) => {
            const def = getSignal(s.signal_type);
            if (!def) return null;
            const km = approxKm(
              coords!.lat,
              coords!.lng,
              unbucketCoord(s.lat_bucket),
              unbucketCoord(s.lng_bucket)
            );
            const tone =
              def.tone === "positive"
                ? "border-accent/20 bg-accent-soft/40"
                : def.tone === "negative"
                  ? "border-danger/20 bg-danger-soft/40"
                  : "border-gold/20 bg-gold-soft/40";
            return (
              <div
                key={s.id}
                className={`flex items-start gap-3 rounded-xl border ${tone} p-3`}
              >
                <span className="text-[1.5rem] leading-none">{def.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[0.9375rem] font-semibold text-ink">
                      {def.label}
                    </p>
                    <span className="shrink-0 font-mono text-[0.7rem] text-faint">
                      {signalAge(s.created_at)}
                    </span>
                  </div>
                  <p className="text-[0.75rem] text-muted">
                    ~{km.toFixed(1)} km away
                  </p>
                  {s.note ? (
                    <p className="mt-1 text-[0.8125rem] italic text-ink/80">
                      &quot;{s.note}&quot;
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[0.7rem] text-faint">
        Signals expire after 3 hours. Location rounded to ~1 km.{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </p>
    </>
  );
}