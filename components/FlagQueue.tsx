"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type FlagRow = {
  id: string;
  session_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  reporter_handle: string | null;
  target_preview: string | null;
  target_author_handle: string | null;
  target_href: string | null;
};

export function FlagQueue({ flags }: { flags: FlagRow[] }) {
  if (flags.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-[0.875rem] text-muted">
          No open content flags right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flags.map((f) => (
        <FlagCard key={f.id} flag={f} />
      ))}
    </div>
  );
}

function FlagCard({ flag }: { flag: FlagRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");

  async function act(action: "dismiss" | "remove" | "ban_user") {
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/admin/moderate-flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          flag_id: flag.id,
          action,
          reason: action === "ban_user" ? banReason.trim() : undefined
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Action failed");
        setBusy(null);
        return;
      }
      if (navigator.vibrate) {
        try {
          navigator.vibrate(25);
        } catch {
          /* ignore */
        }
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(null);
    }
  }

  const reasonLabel: Record<string, string> = {
    spam: "Spam",
    harassment: "Harassment",
    hate: "Hate speech",
    misinformation: "False info",
    scam: "Scam",
    other: "Other"
  };

  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-danger-soft px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-danger">
              {reasonLabel[flag.reason] ?? flag.reason}
            </span>
            <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[0.65rem] text-muted">
              {flag.target_type}
            </span>
            <span className="font-mono text-[0.65rem] text-faint">
              {new Date(flag.created_at).toLocaleDateString("en-NG", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </span>
          </div>

          <p className="mt-2 text-[0.8125rem] text-muted">
            Reported by{" "}
            <span className="font-medium text-ink">
              {flag.reporter_handle ? `@${flag.reporter_handle}` : "Anonymous"}
            </span>
            {flag.target_author_handle ? (
              <>
                {" "}
                · Target author:{" "}
                <span className="font-medium text-ink">
                  @{flag.target_author_handle}
                </span>
              </>
            ) : null}
          </p>

          {flag.note ? (
            <p className="mt-1 text-[0.8125rem] italic text-ink/85">
              &ldquo;{flag.note}&rdquo;
            </p>
          ) : null}
        </div>
      </div>

      {flag.target_preview ? (
        <div className="mt-3 rounded-xl border border-border bg-paper p-3">
          <p className="line-clamp-4 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-ink/85">
            {flag.target_preview}
          </p>
        </div>
      ) : null}

      {flag.target_href ? (
        <Link
          href={flag.target_href}
          className="mt-2 inline-block text-[0.75rem] font-medium text-brand hover:underline"
        >
          Open target →
        </Link>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      {banOpen ? (
        <div className="mt-3 space-y-2 rounded-xl border border-danger/30 bg-danger-soft/30 p-3">
          <textarea
            value={banReason}
            onChange={(e) => setBanReason(e.target.value.slice(0, 300))}
            placeholder="Reason for ban (internal note)"
            rows={2}
            className="!min-h-[56px] text-[0.8125rem]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBanOpen(false);
                setBanReason("");
              }}
              className="flex-1 rounded-lg border border-border-strong bg-paper py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => act("ban_user")}
              disabled={busy != null}
              className="flex-1 rounded-lg bg-danger py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {busy === "ban_user" ? "Banning…" : "Confirm ban"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => act("dismiss")}
            disabled={busy != null}
            className="rounded-lg border border-border-strong bg-paper px-3 py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
          >
            {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
          </button>
          <button
            type="button"
            onClick={() => act("remove")}
            disabled={busy != null}
            className="rounded-lg bg-brand px-3 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-50"
          >
            {busy === "remove" ? "Removing…" : "Remove content"}
          </button>
          <button
            type="button"
            onClick={() => setBanOpen(true)}
            disabled={busy != null}
            className="rounded-lg bg-danger px-3 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Ban user
          </button>
        </div>
      )}
    </article>
  );
}