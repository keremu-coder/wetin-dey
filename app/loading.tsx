export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 h-8 w-40 animate-pulse rounded-lg bg-ink/5" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-ink/5" />
              <div className="flex-1">
                <div className="h-3 w-24 animate-pulse rounded bg-ink/5" />
                <div className="mt-2 h-2 w-16 animate-pulse rounded bg-ink/5" />
              </div>
            </div>
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-ink/5" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-ink/5" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-ink/5" />
          </div>
        ))}
      </div>
    </main>
  );
}