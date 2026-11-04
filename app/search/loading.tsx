export default function SearchLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-4 h-8 w-32 animate-pulse rounded-lg bg-ink/5" />
      <div className="mb-6 h-12 animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}