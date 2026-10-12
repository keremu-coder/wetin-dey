"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Tier = "private" | "followers" | "public";
const OPTIONS: { id: Tier; label: string; desc: string }[] = [
  { id: "private", label: "Private", desc: "Only you see your photo. Everyone else sees your Alama mark." },
  { id: "followers", label: "Followers only", desc: "People who follow you see your photo. Others see your Alama." },
  { id: "public", label: "Public", desc: "Everyone on the app sees your photo." }
];

export default function PhotoVisibilityPage() {
  const [tier, setTier] = useState<Tier>("private");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Tier | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/photo-visibility")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.visibility) setTier(d.visibility); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function pick(id: Tier) {
    if (id === tier) return;
    setSaving(id); setError("");
    try {
      const r = await fetch("/api/settings/photo-visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility: id })
      });
      const j = await r.json();
      if (!r.ok) { setError(j?.error ?? "Could not save"); return; }
      setTier(id);
    } catch { setError("Network error"); }
    finally { setSaving(null); }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-6 pb-28">
      <Link href="/settings" className="text-[0.8125rem] font-medium text-faint hover:text-brand">Back to settings</Link>
      <header className="mt-4 mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Profile photo visibility</h1>
        <p className="mt-1 text-[0.875rem] text-muted">
          Your Alama mark is always visible. Choose who gets to see your real photo.
        </p>
      </header>
      {error ? <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{error}</p> : null}
      <div className="space-y-3">
        {OPTIONS.map(o => {
          const active = o.id === tier;
          return (
            <button key={o.id} type="button" onClick={() => pick(o.id)} disabled={loading || saving !== null}
              className={`flex w-full items-start gap-4 rounded-2xl border bg-surface p-4 text-left transition-colors ${active ? "border-brand" : "border-border hover:border-border-strong"}`}>
              <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-brand" : "border-border-strong"}`}>
                {active ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--brand-ink)" }} /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-semibold text-ink">{o.label}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{o.desc}</p>
              </div>
              {saving === o.id ? <span className="text-[0.75rem] text-faint">Saving…</span> : null}
            </button>
          );
        })}
      </div>
    </main>
  );
}