export default function ReportLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="h-3 w-32 animate-pulse rounded bg-ink/5" />
      <div className="mt-4 mb-5 space-y-2">
        <div className="h-7 w-3/4 animate-pulse rounded-lg bg-ink/5" />
        <div className="h-3 w-40 animate-pulse rounded bg-ink/5" />
      </div>
      <div className="mb-5 h-48 animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="mb-5 h-32 animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="mb-5 h-20 animate-pulse rounded-2xl border border-border bg-surface" />
    </main>
  );
}