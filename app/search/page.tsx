"use client";

import { useState } from "react";
import Link from "next/link";

type User = {
  handle: string;
  handle_kind: string;
  follower_count: number;
  post_count: number;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().replace(/^@/, "");
    if (!q) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.users ?? []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <h1 className="mb-4 font-serif text-[1.5rem] font-semibold text-ink">
        Search
      </h1>

      <form onSubmit={search} className="mb-6">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            🔎
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find people by @handle"
            autoComplete="off"
            className="!pl-11"
          />
        </div>
      </form>

      {loading ? (
        <p className="text-center text-[0.875rem] text-muted">Searching…</p>
      ) : searched && results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-10 text-center">
          <p className="text-[0.9375rem] text-ink">Nobody found.</p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Try a different name.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {results.map((u, i) => (
            <Link
              key={u.handle}
              href={`/u/${encodeURIComponent(u.handle)}`}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/5 ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-[1.05rem] font-semibold text-white">
                {u.handle.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium text-ink">
                  @{u.handle}
                </p>
                <p className="text-[0.75rem] text-muted">
                  {u.post_count} posts · {u.follower_count} followers
                </p>
              </div>
              <span className="text-faint">›</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}