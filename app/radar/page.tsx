"use client";

import { useEffect, useRef, useState } from "react";
import { Alama } from "@/components/Alama";
import { RadarAlarm } from "@/components/RadarAlarm";
import { useBackgroundRadar } from "@/lib/use-background-radar";
import { BackgroundLocationDisclosure } from "@/components/BackgroundLocationDisclosure";
import { useBatteryExemption } from "@/lib/use-battery-exemption";

type Signal = "safe" | "home" | "on_way" | "need_help" | "call_me" | "police_stop";

const SIGNAL_LABELS: Record<Signal, { label: string; hint: string; icon: string }> = {
  safe: { label: "I'm safe", hint: "Let them know you landed", icon: "\u2713" },
  home: { label: "I'm home", hint: "Dey house now", icon: "\u2302" },
  on_way: { label: "On the way", hint: "Coming now", icon: "\u2192" },
  need_help: { label: "Need help", hint: "Urgent. Shares live location.", icon: "!" },
  call_me: { label: "Call me", hint: "Ping, no text needed", icon: "\u260E" },
  police_stop: { label: "Police stop", hint: "Urgent. Shares live location.", icon: "\u26A0" }
};

type InboxItem = {
  id: string;
  sender_id: string;
  signal_type: Signal;
  note: string | null;
  lat: number | null;
  lng: number | null;
  location_sharing: boolean;
  location_stopped: boolean;
  created_at: string;
  location_updated_at: string | null;
  sender: { handle: string; display_name: string | null; avatar_url: string | null } | null;
};

type MineItem = {
  id: string;
  signal_type: Signal;
  note: string | null;
  lat: number | null;
  lng: number | null;
  location_sharing: boolean;
  location_stopped: boolean;
  created_at: string;
  location_updated_at: string | null;
  expires_at: string | null;
};

type Contact = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  mutual?: boolean;
};

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return new Date(iso).toLocaleDateString();
}

function urgency(type: Signal): "danger" | "warn" | "info" {
  if (type === "need_help" || type === "police_stop") return "danger";
  if (type === "call_me") return "warn";
  return "info";
}

export default function RadarPage() {
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [mine, setMine] = useState<MineItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [addHandle, setAddHandle] = useState("");
  const [sending, setSending] = useState<Signal | null>(null);
  const [picking, setPicking] = useState<Signal | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alarmSilenced, setAlarmSilenced] = useState(false);

  const liveWatchRef = useRef<number | null>(null);
  const [bgDisclosureOpen, setBgDisclosureOpen] = useState(false);
  const [bgConsent, setBgConsent] = useState<"granted" | "declined" | null>(null);
  const pendingSendRef = useRef<{ type: Signal; recipients: string[] } | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/radar");
      if (!r.ok) { setError("Could not load"); return; }
      const j = await r.json();
      setInbox(j.inbox ?? []);
      setMine(j.mine ?? []);
      setContacts(j.contacts ?? []);
    } catch { setError("Network error"); }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // Sender-side live location watcher. Fires while I have an active danger
  // signal with location_sharing on and location_stopped off.
  const hasActiveShare = mine.some(
    (m) => m.location_sharing && !m.location_stopped
  );

  // Native-only: keeps Android location flowing when the app is backgrounded.
  useBackgroundRadar(hasActiveShare && bgConsent !== "declined");

  // Load the user's past choice for the background-location disclosure.
  useEffect(() => {
    try {
      const v = localStorage.getItem("radar_bg_consent");
      if (v === "granted" || v === "declined") setBgConsent(v);
    } catch { /* ignore */ }
  }, []);

  // Android-only: nudges the user to exempt us from Doze so background
  // location isn't suspended while a signal is live.
  const battery = useBatteryExemption(hasActiveShare);

  useEffect(() => {
    if (!hasActiveShare) {
      if (liveWatchRef.current) { clearInterval(liveWatchRef.current); liveWatchRef.current = null; }
      return;
    }
    let cancelled = false;
    async function push() {
      if (cancelled) return;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        );
        await fetch("/api/radar/update-location", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        });
      } catch { /* no signal, try again next tick */ }
    }
    void push();
    liveWatchRef.current = window.setInterval(push, 30000);
    return () => {
      cancelled = true;
      if (liveWatchRef.current) { clearInterval(liveWatchRef.current); liveWatchRef.current = null; }
    };
  }, [hasActiveShare]);

  // Alarm fires when the recipient has an unacknowledged danger signal.
  const alarmItem = inbox.find(
    (s) => s.signal_type === "need_help" || s.signal_type === "police_stop" || s.signal_type === "call_me"
  );
  const alarmActive = !!alarmItem && !alarmSilenced;

  async function send(type: Signal, recipients: string[], force = false) {
    // Google Play Prominent Disclosure: show the background-location
    // notice once, before the OS permission prompt fires.
    if ((type === "need_help" || type === "police_stop") && bgConsent === null && !force) {
      pendingSendRef.current = { type, recipients };
      setBgDisclosureOpen(true);
      return;
    }
    let lat: number | null = null;
    let lng: number | null = null;
    if (type === "need_help" || type === "police_stop") {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* no location, still send */ }
    }
    setSending(type); setError("");
    try {
      const r = await fetch("/api/radar/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, recipients, lat, lng })
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j?.error ?? "Could not send"); return; }
      setPicking(null); setSelected(new Set());
      await load();
    } catch { setError("Network error"); }
    finally { setSending(null); }
  }

  async function ack(id: string, stopLocation: boolean) {
    try {
      await fetch("/api/radar/ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, stopLocation })
      });
      setInbox((prev) => prev.filter((s) => s.id !== id));
      setAlarmSilenced(false);
    } catch { setError("Network error"); }
  }

  async function stopMine(id: string) {
    try {
      await fetch("/api/radar/ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, stopLocation: true })
      });
      setMine((prev) => prev.filter((m) => m.id !== id));
    } catch { setError("Network error"); }
  }

  async function addContact() {
    const h = addHandle.trim();
    if (!h) return;
    try {
      const r = await fetch("/api/radar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: h })
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j?.error ?? "Could not add"); return; }
      setAddHandle("");
      await load();
    } catch { setError("Network error"); }
  }

  async function removeContact(id: string) {
    try {
      await fetch("/api/radar", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactId: id })
      });
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  }

  function tapSignal(type: Signal) {
    const mutuals = contacts.filter((c) => c.mutual !== false);
    if (mutuals.length === 0) {
      setError(
        contacts.length > 0
          ? "Your Circle needs to add you back before you can signal them."
          : "Add someone to your Circle first."
      );
      return;
    }
    if (mutuals.length === 1) { void send(type, [mutuals[0].id]); return; }
    setPicking(type);
    setSelected(new Set(mutuals.map((c) => c.id)));
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-6 pb-32">
      <BackgroundLocationDisclosure
        open={bgDisclosureOpen}
        onAccept={() => {
          try { localStorage.setItem("radar_bg_consent", "granted"); } catch {}
          setBgConsent("granted");
          setBgDisclosureOpen(false);
          const pending = pendingSendRef.current;
          pendingSendRef.current = null;
          if (pending) void send(pending.type, pending.recipients, true);
        }}
        onDecline={() => {
          try { localStorage.setItem("radar_bg_consent", "declined"); } catch {}
          setBgConsent("declined");
          setBgDisclosureOpen(false);
          const pending = pendingSendRef.current;
          pendingSendRef.current = null;
          if (pending) void send(pending.type, pending.recipients, true);
        }}
      />
      <RadarAlarm
        active={alarmActive}
        urgency={alarmItem ? urgency(alarmItem.signal_type) : "info"}
        onSilence={() => setAlarmSilenced(true)}
      />

      <header className="mb-6 pt-2">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">Radar</h1>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
          Send a private signal to your Circle. Like a call, but quieter.
        </p>
      </header>

      {error ? <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{error}</p> : null}

      {mine.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-[0.8125rem] font-semibold text-faint">Your active signals</h2>
          {battery.needsPrompt ? (
            <div className="mb-3 rounded-2xl border border-brand/30 bg-brand-tint p-4">
              <p className="text-[0.9375rem] font-semibold text-ink">Keep sharing in the background</p>
              <p className="mt-1 text-[0.8125rem] text-ink/75">
                Android may pause location when the screen is off. Allow Wetin Dey to run without battery limits so your Circle can still see you.
              </p>
              <button
                type="button"
                onClick={() => void battery.request()}
                className="mt-3 rounded-full bg-brand px-4 py-2 text-[0.8125rem] font-semibold text-white"
              >
                Allow
              </button>
            </div>
          ) : null}
          <div className="space-y-3">
            {mine.map((m) => (
              <div key={m.id} className="rounded-2xl border border-brand/40 bg-brand-tint p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-[1.2rem] text-white" aria-hidden>
                    {SIGNAL_LABELS[m.signal_type].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[1rem] font-bold text-ink">{SIGNAL_LABELS[m.signal_type].label}</p>
                    <p className="mt-1 text-[0.8125rem] text-ink/75">
                      Sharing location - {timeAgo(m.location_updated_at ?? m.created_at)}
                    </p>
                      {m.expires_at ? (
                        <p className="mt-0.5 text-[0.8125rem] text-ink/60">
                          Auto-stops at {new Date(m.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                      ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void stopMine(m.id)}
                    className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-[0.8125rem] font-semibold text-white"
                  >
                    I&apos;m safe
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {inbox.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-[0.8125rem] font-semibold text-faint">Waiting for you</h2>
          <div className="space-y-3">
            {inbox.map((s) => {
              const u = urgency(s.signal_type);
              const bg = u === "danger" ? "bg-danger-soft border-danger/40" : u === "warn" ? "bg-warn-tint border-warn/50" : "bg-surface border-border";
              const live = s.location_sharing && !s.location_stopped && s.lat && s.lng;
              return (
                <div key={s.id} className={"rounded-2xl border p-4 " + bg}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                      {s.sender?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.sender.avatar_url} alt="" className="h-10 w-10 object-cover" />
                      ) : (
                        <Alama seed={s.sender_id} size={40} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[1rem] font-bold text-ink">
                        @{s.sender?.handle ?? "Someone"} - {SIGNAL_LABELS[s.signal_type].label}
                      </p>
                      {s.note ? <p className="mt-1 text-[0.9375rem] text-ink/85">{s.note}</p> : null}
                      <p className="mt-1 text-[0.75rem] text-muted">
                        {timeAgo(s.location_updated_at ?? s.created_at)}
                        {live ? " - live location" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => ack(s.id, u === "danger")}
                      className="flex-1 rounded-full bg-brand px-4 py-2.5 text-[0.9375rem] font-semibold text-white"
                    >
                      I see it
                    </button>
                    {live ? (
                      <a
                        href={"https://www.google.com/maps?q=" + s.lat + "," + s.lng}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-border-strong bg-surface px-4 py-2.5 text-[0.9375rem] font-medium text-ink"
                      >
                        Map
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-[0.8125rem] font-semibold text-faint">Send a signal</h2>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(SIGNAL_LABELS) as Signal[]).map((key) => {
            const s = SIGNAL_LABELS[key];
            const isDanger = urgency(key) === "danger";
            return (
              <button
                key={key}
                type="button"
                onClick={() => tapSignal(key)}
                disabled={sending !== null}
                className={"flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors " + (isDanger ? "border-danger/40 bg-danger-soft" : "border-border bg-surface hover:bg-ink/5")}
              >
                <span className={"text-[1.5rem] leading-none " + (isDanger ? "text-danger" : "text-ink")}>{s.icon}</span>
                <span className="text-[0.9375rem] font-semibold text-ink">{s.label}</span>
                <span className="text-[0.75rem] text-muted">{s.hint}</span>
                {sending === key ? <span className="text-[0.75rem] text-brand">Sending...</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[0.8125rem] font-semibold text-faint">My Circle</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={addHandle}
            onChange={(e) => setAddHandle(e.target.value.slice(0, 30))}
            placeholder="@handle"
            className="flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") void addContact(); }}
          />
          <button
            type="button"
            onClick={() => void addContact()}
            className="rounded-xl bg-brand px-4 py-2 text-[0.875rem] font-semibold text-white"
          >
            Add
          </button>
        </div>
        {contacts.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3.5">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt="" className="h-10 w-10 object-cover" />
                  ) : (
                    <Alama seed={c.id} size={40} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">@{c.handle ?? "unknown"}</p>
                    {c.mutual === false ? (
                      <span className="shrink-0 rounded-full bg-warm-soft px-2 py-0.5 text-[0.65rem] font-semibold text-warm-deep">Pending</span>
                    ) : null}
                  </div>
                  {c.mutual === false ? (
                    <p className="truncate text-[0.75rem] text-muted">They need to add you back.</p>
                  ) : c.display_name ? (
                    <p className="truncate text-[0.75rem] text-muted">{c.display_name}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void removeContact(c.id)}
                  className="text-[0.75rem] font-medium text-danger"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[0.875rem] text-muted">Add people you trust. They will get your signals.</p>
        )}
      </section>

      {picking ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setPicking(null)} />
          <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl bg-surface p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <h3 className="font-serif text-[1.25rem] font-semibold text-ink">Send {SIGNAL_LABELS[picking].label} to</h3>
            <ul className="mt-4 space-y-2">
              {contacts.map((c) => {
                const on = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(selected);
                        if (on) next.delete(c.id); else next.add(c.id);
                        setSelected(next);
                      }}
                      className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (on ? "border-brand bg-brand-tint" : "border-border")}
                    >
                      <span className={"flex h-5 w-5 items-center justify-center rounded-md border-2 " + (on ? "border-brand bg-brand text-white" : "border-border-strong")}>
                        {on ? "\u2713" : ""}
                      </span>
                      <span className="text-[0.9375rem] font-medium text-ink">@{c.handle ?? "unknown"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPicking(null)} className="flex-1 rounded-xl border border-border-strong bg-surface py-3 text-[0.875rem] font-medium text-ink">Cancel</button>
              <button
                type="button"
                onClick={() => void send(picking, Array.from(selected))}
                disabled={selected.size === 0 || sending !== null}
                className="flex-1 rounded-xl bg-brand py-3 text-[0.875rem] font-semibold text-white disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}