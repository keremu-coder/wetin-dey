import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-paper/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="group flex items-center gap-2 transition-opacity hover:opacity-90"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-accent transition-transform group-hover:scale-125"
          />
          <span className="font-serif text-[1.35rem] font-semibold leading-none tracking-tight text-ink">
            Wetin Dey
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-0.5 text-[0.875rem]">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Talk Am
          </Link>
          <Link
            href="/community"
            className="rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Community
          </Link>
          <Link
            href="/explore"
            className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink sm:block"
          >
            Explore
          </Link>
          <Link
            href="/me"
            className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink sm:block"
          >
            My posts
          </Link>
          <Link
            href="/settings"
            className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink sm:block"
          >
            Settings
          </Link>
          <Link
            href="/submit"
            className="ml-1 rounded-xl bg-warm px-4 py-2 font-medium text-white shadow-button transition-all hover:bg-warm-deep hover:shadow-card"
          >
            Post
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-3xl px-4 pb-12">
      <div className="border-t border-border pt-6">
        <p className="text-[0.875rem] leading-relaxed text-muted">
          Wetin Dey na community. Anonymous if you want. No court judgment — na talk.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-faint">
          <Link href="/terms" className="transition-colors hover:text-accent">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-accent">
            Privacy
          </Link>
          <Link href="/guidelines" className="transition-colors hover:text-accent">
            Guidelines
          </Link>
          <Link href="/takedown" className="transition-colors hover:text-accent">
            Takedown
          </Link>
          <Link href="/support" className="transition-colors hover:text-accent">
            Support
          </Link>
          <span className="ml-auto font-mono text-[0.75rem] text-faint">
            made in Nigeria 🇳🇬
          </span>
        </div>
      </div>
    </footer>
  );
}