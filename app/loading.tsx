export default function RootLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-4 pb-6">
      {/* StatusBar skeleton — matches avatar + handle + status + Edit pill */}
      <div className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3.5">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-ink/5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-2.5 w-24 animate-pulse rounded bg-ink/5" />
          <div className="h-3.5 w-40 animate-pulse rounded bg-ink/5" />
        </div>
        <div className="h-7 w-14 shrink-0 animate-pulse rounded-full bg-ink/5" />
      </div>

      {/* Spaces heading skeleton — matches heading + explore icon + New pill */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="h-7 w-28 animate-pulse rounded-lg bg-ink/5" />
        <div className="flex items-center gap-1">
          <div className="h-9 w-9 animate-pulse rounded-full bg-ink/5" />
          <div className="h-9 w-20 animate-pulse rounded-full bg-ink/5" />
        </div>
      </div>

      {/* Space list skeleton — single card with rows, matches real layout */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-3.5 py-3 ${
              i !== 0 ? "border-t border-border" : ""
            }`}
          >
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-ink/5" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-ink/5" />
                <div className="h-2.5 w-8 animate-pulse rounded bg-ink/5" />
              </div>
              <div className="h-3 w-2/3 animate-pulse rounded bg-ink/5" />
              <div className="h-2 w-20 animate-pulse rounded bg-ink/5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}