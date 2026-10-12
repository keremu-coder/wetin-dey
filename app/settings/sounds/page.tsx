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
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush
} from "@/lib/push-client";
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
  const [pushReady, setPushReady] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  useEffect(() => {
    setPrefs(loadPrefs());
    setPermission(notificationPermission());
    setPushReady(pushSupported());
  }, []);

  function update<K extends keyof SoundPrefs>(key: K, value: SoundPrefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  function pickProfile(id: SoundProfileId) {
    unlockAudio();
    update("profile", id);
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
      // Also register push subscription now that we have permission.
      if (pushSupported()) {
        setPushBusy(true);
        const ok2 = await subscribeToPush();
        setPushBusy(false);
        setPushMsg(
          ok2
            ? "Push notifications are now active on this device."
            : "Could not subscribe to push. Try reloading the page."
        );
      }
    }
  }

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMsg("");
    try {
      if (prefs.browserNotifications && pushReady) {
        await unsubscribeFromPush();
        update("browserNotifications", false);
        setPushMsg("Push notifications turned off on this device.");
      } else {
        const ok = await requestNotificationPermission();
        setPermission(notificationPermission());
        if (!ok) {
          setPushMsg("Notifications are blocked. Allow them in your browser settings.");
        } else {
          const ok2 = await subscribeToPush();
          if (ok2) {
            update("browserNotifications", true);
            setPushMsg("Push notifications are now active on this device.");
          } else {
            setPushMsg("Could not subscribe. On iPhone, add the app to your home screen first.");
          }
        }
      }
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <Link
        href="/settings"
        className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-brand"
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
                  selected ? "!border-brand" : "hover:!border-border-strong"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-brand bg-brand"
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
                      <span className="rounded-full bg-brand-tint px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-brand">
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

      <section className="mb-6">
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          Push notifications
        </p>
        <div className="rounded-2xl border border-border bg-surface p-4">
          {!pushReady ? (
            <p className="text-[0.8125rem] text-muted">
              Your browser does not support push notifications. Try Chrome,
              Edge, or a modern Safari.
            </p>
          ) : permission === "unsupported" ? (
            <p className="text-[0.8125rem] text-muted">
              Push notifications are not available on this device.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-medium text-ink">
                    {prefs.browserNotifications
                      ? "Notifications enabled"
                      : "Enable notifications"}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    Get pinged when a message arrives even if the app is
                    closed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={togglePush}
                  disabled={pushBusy}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    prefs.browserNotifications ? "bg-brand" : "bg-ink/10"
                  } ${pushBusy ? "opacity-50" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      prefs.browserNotifications
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {permission === "default" ? (
                <button
                  type="button"
                  onClick={askNotifications}
                  className="mt-3 rounded-xl bg-brand px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-brand-soft"
                >
                  Allow notifications
                </button>
              ) : null}

              {permission === "denied" ? (
                <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.75rem] text-danger">
                  Notifications are blocked in your browser settings. On iPhone
                  Safari, you must first add Wetin Dey to your home screen.
                </p>
              ) : null}

              {pushMsg ? (
                <p className="mt-3 rounded-xl bg-brand-tint px-3 py-2 text-[0.75rem] text-brand">
                  {pushMsg}
                </p>
              ) : null}

              <p className="mt-4 text-[0.7rem] leading-relaxed text-faint">
                iPhone users: add Wetin Dey to your home screen first (tap
                Share → Add to Home Screen), then return here and enable.
                Safari blocks push for non-installed web apps.
              </p>
            </>
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
      <span className="text-[1.1rem] text-brand">{icon}</span>
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
          value ? "bg-brand" : "bg-ink/10"
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