export default function MeLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-ink/5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-ink/5" />
          <div className="h-3.5 w-24 animate-pulse rounded bg-ink/5" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}