export default function ExploreLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-28">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-ink/5" />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-md border border-border bg-surface"
          />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-surface"
          />
        ))}
      </div>
      <div className="mt-8 h-80 animate-pulse rounded-2xl border border-border bg-surface" />
    </main>
  );
}