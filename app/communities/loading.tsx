export default function CommunitiesLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-7 w-24 animate-pulse rounded-lg bg-ink/5" />
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink/5" />
        </div>
        <div className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-ink/5" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
          >
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-ink/5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-ink/5" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-ink/5" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-ink/5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}