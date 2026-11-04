export default function SettingsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-ink/5" />
        <div className="h-7 w-28 animate-pulse rounded-lg bg-ink/5" />
      </div>
      <div className="mb-6 h-20 animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="mb-6 h-32 animate-pulse rounded-2xl border border-border bg-surface" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-6">
          <div className="mb-2 h-3 w-24 animate-pulse rounded bg-ink/5" />
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>
      ))}
    </main>
  );
}