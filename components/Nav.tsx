import Link from "next/link";
import { UserMenu } from "./UserMenu";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-paper/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 transition-opacity hover:opacity-90"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-accent"
          />
          <span className="font-serif text-[1.15rem] font-semibold leading-none tracking-tight text-ink sm:text-[1.35rem]">
            Wetin Dey
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 text-[0.8125rem] sm:text-[0.875rem]">
          <Link
            href="/"
            className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink sm:block"
          >
            Talk Am
          </Link>
          <Link
            href="/community"
            className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink sm:block"
          >
            Community
          </Link>
          <Link
            href="/explore"
            className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink md:block"
          >
            Explore
          </Link>
          <Link
            href="/submit"
            className="rounded-xl bg-warm px-3 py-2 font-medium text-white shadow-button transition-all hover:bg-warm-deep sm:px-4"
          >
            Post
          </Link>
          <UserMenu />
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