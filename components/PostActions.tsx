"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  postId: string;
  isReport: boolean; // true for Talk Am reports → show "Me too", false for community → show up/down
  authorHandle: string | null;
  isOwnPost: boolean;
  initialUpvotes: number;
  initialDownvotes: number;
  initialMeToo: number;
  commentCount: number;
  evidenceLink?: string | null;
  postUrl: string;
};

export function PostActions({
  postId,
  isReport,
  authorHandle,
  isOwnPost,
  initialUpvotes,
  initialDownvotes,
  initialMeToo,
  commentCount,
  evidenceLink,
  postUrl
}: Props) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [meToo, setMeToo] = useState(initialMeToo);
  const [myVote, setMyVote] = useState<"up" | "down" | "me_too" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${postId}/vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUpvotes(d.upvotes ?? 0);
        setDownvotes(d.downvotes ?? 0);
        setMeToo(d.me_too ?? 0);
        setMyVote(d.my_vote ?? null);
      })
      .catch(() => {});
  }, [postId]);

  async function vote(v: "up" | "down" | "me_too") {
    const res = await fetch(`/api/posts/${postId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vote: v })
    });
    if (!res.ok) return;
    const d = await res.json();
    setUpvotes(d.upvotes);
    setDownvotes(d.downvotes);
    setMeToo(d.me_too);
    setMyVote(d.my_vote);
  }

  async function share() {
    const fullUrl = typeof window !== "undefined" ? window.location.origin + postUrl : postUrl;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "Wetin Dey",
          text: "See this one for Wetin Dey:",
          url: fullUrl
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(fullUrl);
      alert("Link copied. Paste am anywhere.");
    } catch {
      /* ignore */
    }
  }

  async function blockUser() {
    if (!authorHandle) return;
    await fetch("/api/block", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: authorHandle, action: "block" })
    });
    setMenuOpen(false);
    window.location.reload();
  }

  async function deleteOwnPost() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/";
    }
  }

  async function copyLink() {
    const fullUrl =
      typeof window !== "undefined" ? window.location.origin + postUrl : postUrl;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setMenuOpen(false);
      alert("Link copied.");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {isReport ? (
        // Talk Am: "Me too" + downvote
        <>
          <button
            type="button"
            onClick={() => vote("me_too")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
              myVote === "me_too"
                ? "bg-accent text-white"
                : "bg-ink/5 text-muted hover:bg-accent-soft hover:text-accent-deep"
            }`}
          >
            ✋ Me too · {meToo}
          </button>
          <button
            type="button"
            onClick={() => vote("down")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
              myVote === "down"
                ? "bg-danger text-white"
                : "bg-ink/5 text-muted hover:bg-danger-soft hover:text-danger"
            }`}
          >
            👎 {downvotes}
          </button>
        </>
      ) : (
        // Community: upvote + downvote
        <>
          <button
            type="button"
            onClick={() => vote("up")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
              myVote === "up"
                ? "bg-accent text-white"
                : "bg-ink/5 text-muted hover:bg-accent-soft hover:text-accent-deep"
            }`}
          >
            👍 {upvotes}
          </button>
          <button
            type="button"
            onClick={() => vote("down")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
              myVote === "down"
                ? "bg-danger text-white"
                : "bg-ink/5 text-muted hover:bg-danger-soft hover:text-danger"
            }`}
          >
            👎 {downvotes}
          </button>
        </>
      )}

      <Link
        href={`/r/${postId}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:bg-ink/10"
      >
        💬 {commentCount}
      </Link>

      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:bg-ink/10"
      >
        🔗 Share
      </button>

      <div className="relative ml-auto" style={{ zIndex: 30 }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg px-2 py-1 text-[0.75rem] text-faint transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label="More"
        >
          •••
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-border bg-surface p-1 shadow-card-hover">
            <Link
              href={`/r/${postId}`}
              className="block rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
            >
              Open post
            </Link>
            <button
              type="button"
              onClick={copyLink}
              className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
            >
              Copy link
            </button>
            {evidenceLink ? (
              <a
                href={evidenceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
              >
                View evidence source
              </a>
            ) : null}
            {isOwnPost ? (
              <button
                type="button"
                onClick={deleteOwnPost}
                className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft"
              >
                Delete my post
              </button>
            ) : null}
            {authorHandle && !isOwnPost ? (
              <button
                type="button"
                onClick={blockUser}
                className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft"
              >
                Block @{authorHandle}
              </button>
            ) : null}
            <Link
              href={`/takedown?post=${postId}`}
              className="block rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
            >
              Report or dispute
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}