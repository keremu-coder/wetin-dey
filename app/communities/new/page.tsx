"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  validateCommunityName,
  validateCommunityDescription,
  slugFromName
} from "@/lib/community-naming";

const STARTER_IDEAS = [
  { emoji: "🏠", name: "Family group", slug: "family-group" },
  { emoji: "⛪", name: "Church cell", slug: "church-cell" },
  { emoji: "🛡️", name: "Estate security", slug: "estate-security" },
  { emoji: "🎓", name: "Old classmates", slug: "old-classmates" }
];

export default function NewCommunityPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🇳🇬");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  const nameCheck = useMemo(() => validateCommunityName(name), [name]);
  const descCheck = useMemo(
    () => validateCommunityDescription(description),
    [description]
  );

  const nameError =
    nameTouched && name.length > 0 && !nameCheck.ok ? nameCheck.reason : null;

  const nameOk = nameCheck.ok;
  const canSubmit = nameOk && descCheck.ok && !busy;

  function applyStarter(idea: { emoji: string; name: string; slug: string }) {
    setEmoji(idea.emoji);
    setName(idea.name);
    setSlug(idea.slug);
    setNameTouched(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const n = validateCommunityName(name);
    if (!n.ok) {
      setNameTouched(true);
      setError(n.reason);
      return;
    }
    const d = validateCommunityDescription(description);
    if (!d.ok) {
      setError(d.reason);
      return;
    }

    setBusy(true);

    const finalSlug = slug.trim() ? slug.trim() : slugFromName(n.normalized);

    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: n.normalized,
          slug: finalSlug,
          description: d.normalized,
          emoji,
          is_public: isPublic
        })
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not create community.");
        setBusy(false);
        return;
      }

      router.push(`/c/${json.community.slug}`);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/communities"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Create a space
        </h1>
      </div>

      {name === "" && slug === "" && description === "" ? (
        <div className="mb-6">
          <p className="mb-2 px-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            Or start from an idea
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STARTER_IDEAS.map((idea) => (
              <button
                key={idea.slug}
                type="button"
                onClick={() => applyStarter(idea)}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-accent"
              >
                <span className="text-[1.35rem]">{idea.emoji}</span>
                <span className="truncate text-[0.8125rem] font-medium text-ink">
                  {idea.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
            maxLength={40}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!nameTouched) setNameTouched(true);
            }}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g. Lagos Estate Watch"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "name-error" : undefined}
          />
          {nameError ? (
            <p
              id="name-error"
              className="mt-1.5 text-[0.75rem] text-danger"
            >
              {nameError}
            </p>
          ) : name.length === 0 ? (
            <p className="mt-1.5 text-[0.75rem] text-faint">
              A real name. Not a keyboard mash.
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
            URL slug{" "}
            <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              )
            }
            placeholder="lagos-estate-watch"
            pattern="[a-z0-9\-]+"
          />
          <p className="mt-1 text-[0.7rem] text-faint">
            Lowercase letters, numbers, hyphens. Leave empty to use the name.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-[0.8125rem] font-semibold text-ink">
            Description{" "}
            <span className="font-normal text-faint">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="What is this space about?"
          />
          <p className="mt-1 text-right font-mono text-[0.7rem] text-faint">
            {description.length}/200
          </p>
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
              <p className="text-[0.875rem] font-semibold text-ink">
                🌍 Public
              </p>
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
              <p className="text-[0.875rem] font-semibold text-ink">
                🔒 Private
              </p>
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
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-accent px-5 py-4 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create space"}
        </button>
      </form>
    </main>
  );
}