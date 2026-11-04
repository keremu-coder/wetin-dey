export default function RadarLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-4">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-ink/5" />
        <div className="mt-2 h-3.5 w-full animate-pulse rounded bg-ink/5" />
      </div>
      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        <div className="h-5 w-20 animate-pulse rounded bg-ink/5" />
        <div className="h-5 w-20 animate-pulse rounded bg-ink/5" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}