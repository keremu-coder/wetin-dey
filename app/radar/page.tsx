"use client";

import { useEffect, useState } from "react";
import { Alama } from "@/components/Alama";

type Signal = "safe" | "home" | "on_way" | "need_help" | "call_me" | "police_stop";

const SIGNAL_LABELS: Record<Signal, { label: string; hint: string; icon: string }> = {
  safe: { label: "I'm safe", hint: "Let them know you landed", icon: "\u2713" },
  home: { label: "I'm home", hint: "Dey house now", icon: "\u2302" },
  on_way: { label: "On the way", hint: "Coming now", icon: "\u2192" },
  need_help: { label: "Need help", hint: "Urgent. Sends location.", icon: "!" },
  call_me: { label: "Call me", hint: "Ping, no text needed", icon: "\u260E" },
  police_stop: { label: "Police stop", hint: "Urgent. Shares location.", icon: "\u26A0" }
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
  sender: { handle: string; display_name: string | null; avatar_url: string | null } | null;
};

type Contact = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [addHandle, setAddHandle] = useState("");
  const [sending, setSending] = useState<Signal | null>(null);
  const [picking, setPicking] = useState<Signal | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const r = await fetch("/api/radar");
      if (!r.ok) { setError("Could not load"); return; }
      const j = await r.json();
      setInbox(j.inbox ?? []);
      setContacts(j.contacts ?? []);
    } catch { setError("Network error"); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function send(type: Signal, recipients: string[]) {
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
    if (contacts.length === 0) { setError("Add someone to your Circle first."); return; }
    if (contacts.length === 1) { void send(type, [contacts[0].id]); return; }
    setPicking(type);
    setSelected(new Set(contacts.map((c) => c.id)));
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-6 pb-32">
      <header className="mb-6">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">Radar</h1>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
          Send a private signal to your Circle. Like a call, but quieter.
        </p>
      </header>

      {error ? <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{error}</p> : null}

      {inbox.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wider text-faint">Waiting for you</h2>
          <div className="space-y-3">
            {inbox.map((s) => {
              const u = urgency(s.signal_type);
              const bg = u === "danger" ? "bg-danger-soft border-danger/40" : u === "warn" ? "bg-warn-tint border-warn/50" : "bg-surface border-border";
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
                        {timeAgo(s.created_at)}
                        {s.location_sharing && !s.location_stopped && s.lat && s.lng
                          ? " - location sharing"
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => ack(s.id, u === "danger")}
                      className="flex-1 rounded-full bg-primary px-4 py-2.5 text-[0.9375rem] font-semibold text-white"
                    >
                      I see it
                    </button>
                    {s.location_sharing && !s.location_stopped && s.lat && s.lng ? (
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
        <h2 className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wider text-faint">Send a signal</h2>
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
        <h2 className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wider text-faint">My Circle</h2>
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
                  <p className="truncate text-[0.9375rem] font-semibold text-ink">@{c.handle ?? "unknown"}</p>
                  {c.display_name ? <p className="truncate text-[0.75rem] text-muted">{c.display_name}</p> : null}
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