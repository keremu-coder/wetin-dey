import Link from "next/link";

export const metadata = {
  title: "Offline — Wetin Dey"
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="text-[3rem]">📡</div>
      <h1 className="mt-4 font-serif text-[1.75rem] font-semibold leading-tight text-ink">
        You dey offline
      </h1>
      <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-muted">
        Your internet don cut. Everything wey you don load before still dey
        cached. When internet come back, refresh the page.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-2xl bg-brand px-5 py-3 font-serif text-[0.9375rem] font-semibold text-white shadow-button transition-colors hover:bg-brand-soft"
        >
          Try home again
        </Link>
        <Link
          href="/talk"
          className="rounded-2xl border border-border-strong bg-surface px-5 py-3 font-serif text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-ink/5"
        >
          Talk Am
        </Link>
      </div>

      <p className="mt-8 text-[0.75rem] leading-relaxed text-faint">
        Offline mode caches static files only. Reports, chat, and DMs need a
        live connection.
      </p>
    </main>
  );
}