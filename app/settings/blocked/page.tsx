"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Blocked = { session_id: string; handle: string };

export default function BlockedUsersPage() {
  const [list, setList] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/block")
      .then((r) => r.json())
      .then((d) => setList(d.blocked ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function unblock(handle: string) {
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle, action: "unblock" })
    });
    if (res.ok) {
      setList((prev) => prev.filter((b) => b.handle !== handle));
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/settings"
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← Back to settings
        </Link>
        <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-tight text-ink">
          Blocked users
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          People you don block no go fit see your posts, comment, or message you.
        </p>
      </div>

      {loading ? (
        <p className="text-[0.875rem] text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <p className="font-serif text-lg text-ink">Nobody dey blocked.</p>
          <p className="mt-1 text-[0.875rem] text-muted">
            When you block someone, dem go show here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <div
              key={b.session_id}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-card"
            >
              <span className="text-[0.9375rem] font-medium text-ink">
                @{b.handle}
              </span>
              <button
                type="button"
                onClick={() => unblock(b.handle)}
                className="rounded-xl border border-border-strong bg-surface px-3 py-1.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}