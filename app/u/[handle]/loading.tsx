export default function ProfileLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-ink/5" />
        <div className="h-4 w-24 animate-pulse rounded bg-ink/5" />
        <div className="h-10 w-10 animate-pulse rounded-full bg-ink/5" />
      </div>
      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-ink/5" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-ink/5" />
            <div className="h-3.5 w-24 animate-pulse rounded bg-ink/5" />
            <div className="h-3 w-32 animate-pulse rounded bg-ink/5" />
          </div>
        </div>
      </section>
      <div className="mt-6 flex gap-1 border-b border-border pb-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-5 flex-1 animate-pulse rounded bg-ink/5"
          />
        ))}
      </div>
      <div className="mt-4 space-y-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}