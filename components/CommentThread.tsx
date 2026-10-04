"use client";

import { useState } from "react";
import type { Comment } from "@/lib/types";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export function CommentThread({
  reportId,
  initial
}: {
  reportId: string;
  initial: Comment[];
}) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/reports/${reportId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body })
    });
    const json = (await res.json()) as { comment?: Comment; error?: string };
    if (!res.ok) {
      setError(json.error ?? "comment no send");
      setBusy(false);
      return;
    }
    if (json.comment) setComments([json.comment, ...comments]);
    setBody("");
    setBusy(false);
  }

  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl">Wetin people dey talk</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={1}
          maxLength={2000}
          placeholder="Add comment. No drop name or phone number."
        />
        {error ? <p className="text-red-800">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Dey send…" : "Send comment"}
        </Button>
      </form>
      <ul className="mt-6 space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="border-t border-ink/10 pt-3">
            <p className="whitespace-pre-wrap text-base leading-relaxed">{c.body}</p>
            <p className="mt-1 text-xs text-ink/50">{new Date(c.created_at).toLocaleString("en-NG")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
