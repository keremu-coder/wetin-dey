export default function InboxLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6">
        <div className="h-7 w-24 animate-pulse rounded-lg bg-ink/5" />
        <div className="mt-2 h-3.5 w-2/3 animate-pulse rounded bg-ink/5" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-4 py-3.5 ${
              i !== 0 ? "border-t border-border" : ""
            }`}
          >
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-ink/5" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-ink/5" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-ink/5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}