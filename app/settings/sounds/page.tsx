"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SOUND_PROFILES,
  playProfile,
  unlockAudio,
  notificationSupported,
  notificationPermission,
  requestNotificationPermission,
  vibrate,
  type SoundProfileId
} from "@/lib/sounds";
import {
  loadPrefs,
  savePrefs,
  DEFAULT_PREFS,
  type SoundPrefs
} from "@/lib/sound-prefs";

export default function SoundSettingsPage() {
  const [prefs, setPrefs] = useState<SoundPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    setPrefs(loadPrefs());
    setPermission(notificationPermission());
  }, []);

  function update<K extends keyof SoundPrefs>(key: K, value: SoundPrefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  function pickProfile(id: SoundProfileId) {
    unlockAudio();
    update("profile", id);
    // preview the receive sound
    setTimeout(() => playProfile(id, "receive"), 50);
  }

  function preview(event: "send" | "receive" | "mention" | "notification") {
    unlockAudio();
    playProfile(prefs.profile, event);
    if (prefs.vibrate && event === "mention") vibrate([40, 60, 40]);
  }

  async function askNotifications() {
    const ok = await requestNotificationPermission();
    setPermission(notificationPermission());
    if (ok) {
      update("browserNotifications", true);
    }
  }

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
          Sounds &amp; notifications
        </h1>
        <p className="mt-1 text-[0.875rem] text-muted">
          Pick your ping. Default is BBM — that classic Nigerian two-tone.
        </p>
      </header>

      {/* Sound profile picker */}
      <section className="mb-6">
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          Sound profile
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(SOUND_PROFILES) as SoundProfileId[]).map((id) => {
            const p = SOUND_PROFILES[id];
            const selected = prefs.profile === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pickProfile(id)}
                className={`card flex items-start gap-3 p-4 text-left transition-colors ${
                  selected ? "!border-accent" : "hover:!border-border-strong"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-accent bg-accent"
                      : "border-border-strong"
                  }`}
                >
                  {selected ? (
                    <span className="text-[0.7rem] font-bold text-white">✓</span>
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="m-0 text-[0.9375rem] font-semibold text-ink">
                      {p.label}
                    </p>
                    {id === "bbm" ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-accent-deep">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    {p.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Per-event toggles */}
      <section className="mb-6">
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          When should it play
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <Row
            icon="📤"
            label="When I send a message"
            hint="Little confirmation ping"
            value={prefs.send}
            onChange={(v) => update("send", v)}
            onPreview={() => preview("send")}
          />
          <Row
            icon="📥"
            label="When I receive a message"
            hint="Someone sent something new"
            value={prefs.receive}
            onChange={(v) => update("receive", v)}
            onPreview={() => preview("receive")}
          />
          <Row
            icon="@"
            label="When someone @mentions me"
            hint="Louder — for your attention"
            value={prefs.mention}
            onChange={(v) => update("mention", v)}
            onPreview={() => preview("mention")}
          />
          <Row
            icon="🔔"
            label="Other notifications"
            hint="Me-too thresholds, status changes"
            value={prefs.notification}
            onChange={(v) => update("notification", v)}
            onPreview={() => preview("notification")}
          />
          <Row
            icon="📳"
            label="Vibrate"
            hint="Haptic tap on mention and send"
            value={prefs.vibrate}
            onChange={(v) => update("vibrate", v)}
          />
        </div>
      </section>

      {/* Browser notifications */}
      <section className="mb-6">
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          Browser notifications
        </p>
        <div className="rounded-2xl border border-border bg-surface p-4">
          {permission === "unsupported" ? (
            <p className="text-[0.8125rem] text-muted">
              Your browser does not support notifications.
            </p>
          ) : permission === "denied" ? (
            <p className="text-[0.8125rem] text-muted">
              Notifications are blocked. Open your browser settings for this
              site and allow notifications, then reload.
            </p>
          ) : permission === "granted" ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.875rem] font-medium text-ink">
                  Notifications enabled
                </p>
                <p className="mt-0.5 text-[0.75rem] text-muted">
                  You&apos;ll get a notification when a message arrives while
                  the tab is in the background.
                </p>
              </div>
              <button
                type="button"
                onClick={() => update("browserNotifications", !prefs.browserNotifications)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs.browserNotifications ? "bg-accent" : "bg-ink/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    prefs.browserNotifications ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[0.875rem] font-medium text-ink">
                Enable notifications
              </p>
              <p className="mt-0.5 text-[0.75rem] text-muted">
                So you do not miss a message when the app is in another tab.
              </p>
              <button
                type="button"
                onClick={askNotifications}
                className="mt-3 rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
              >
                Allow notifications
              </button>
            </div>
          )}
        </div>
      </section>

      <p className="mt-6 text-center text-[0.75rem] text-faint">
        Sound settings are stored on this device only.
      </p>
    </main>
  );
}

function Row({
  icon,
  label,
  hint,
  value,
  onChange,
  onPreview
}: {
  icon: string;
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onPreview?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-b-0">
      <span className="text-[1.1rem] text-accent-deep">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-medium text-ink">{label}</p>
        <p className="text-[0.75rem] text-muted">{hint}</p>
      </div>
      {onPreview ? (
        <button
          type="button"
          onClick={onPreview}
          className="rounded-lg border border-border-strong bg-paper px-2.5 py-1 text-[0.7rem] font-medium text-ink transition-colors hover:bg-ink/5"
        >
          Test
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-accent" : "bg-ink/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}