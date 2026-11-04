// Display approved right-of-reply responses attached to a report.
// Server-rendered. No client fetch.
//
// The caller (app/r/[id]/page.tsx) is responsible for filtering out
// replies from blocked users before passing them in — this component
// just renders whatever list it receives.

export type PublishedReply = {
  id: string;
  session_id?: string | null;
  submitter_name: string;
  body: string;
  approved_at: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function PublishedReplies({ replies }: { replies: PublishedReply[] }) {
  if (replies.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[1.15rem]">⚖️</span>
        <h2 className="font-serif text-[1.15rem] font-semibold text-ink">
          Right of reply
        </h2>
      </div>
      <p className="mb-4 text-[0.8125rem] leading-relaxed text-muted">
        A response from a party named in this report, published as-is.
      </p>

      <div className="space-y-3">
        {replies.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.875rem] font-semibold text-ink">
                {r.submitter_name}
              </p>
              <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[0.65rem] text-brand">
                ✓ Verified
              </span>
            </div>
            <p className="mt-0.5 text-[0.65rem] text-faint">
              {formatDate(r.approved_at ?? r.created_at)}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink/90">
              {r.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}