"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCommunityPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🇳🇬");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const res = await fetch("/api/communities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, slug: slug || name, description, emoji, is_public: isPublic })
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not create community.");
      setBusy(false);
      return;
    }

    router.push(`/c/${json.community.slug}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/communities"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Create a space
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
            Emoji
          </label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            className="!w-20 !text-center !text-[1.5rem]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
            Name
          </label>
          <input
            type="text"
            required
            minLength={3}
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lagos Traffic Watch"
          />
        </div>

        <div>
          <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
            URL slug <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="lagos-traffic-watch"
            pattern="[a-z0-9\-]+"
          />
          <p className="mt-1 text-[0.7rem] text-faint">
            Lowercase letters, numbers, hyphens. Leave empty to use the name.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
            Description <span className="font-normal text-faint">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="What is this space about?"
          />
        </div>

        <div>
          <p className="mb-2 text-[0.8125rem] font-semibold text-ink">
            Visibility
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                isPublic
                  ? "border-accent bg-accent-soft/40"
                  : "border-border-strong hover:bg-ink/5"
              }`}
            >
              <p className="text-[0.875rem] font-semibold text-ink">🌍 Public</p>
              <p className="mt-0.5 text-[0.7rem] text-muted">
                Anyone can find and join
              </p>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                !isPublic
                  ? "border-accent bg-accent-soft/40"
                  : "border-border-strong hover:bg-ink/5"
              }`}
            >
              <p className="text-[0.875rem] font-semibold text-ink">🔒 Private</p>
              <p className="mt-0.5 text-[0.7rem] text-muted">
                Invite only. Not in discovery.
              </p>
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
            <p className="text-[0.875rem] text-danger">{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-warm px-5 py-4 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-warm-deep disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create space"}
        </button>
      </form>
    </main>
  );
}