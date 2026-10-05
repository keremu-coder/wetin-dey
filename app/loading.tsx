export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
      <p className="mt-3 text-[0.8125rem] text-faint">Loading…</p>
    </div>
  );
}