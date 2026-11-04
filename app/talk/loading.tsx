export default function TalkLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        <div className="h-5 w-20 animate-pulse rounded skeleton" />
        <div className="h-5 w-24 animate-pulse rounded skeleton" />
      </div>
      <div className="mb-6">
        <div className="h-8 w-40 animate-pulse rounded-lg skeleton" />
        <div className="mt-2 h-3.5 w-full animate-pulse rounded skeleton" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="h-3 w-24 animate-pulse rounded skeleton" />
            <div className="mt-3 h-5 w-3/4 animate-pulse rounded skeleton" />
            <div className="mt-2 h-3.5 w-full animate-pulse rounded skeleton" />
            <div className="mt-1.5 h-3.5 w-5/6 animate-pulse rounded skeleton" />
          </div>
        ))}
      </div>
    </main>
  );
}