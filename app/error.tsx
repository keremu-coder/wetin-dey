"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Catches any unhandled error thrown while
 * rendering a route under app/. Replaces Next's default error screen
 * with a branded fallback and a recovery action.
 *
 * The error message is not shown to the user — same principle as the
 * Server-error API fix. Detail goes to the console (captured by Vercel)
 * where it's visible to the team but not to end users.
 */
export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-[3rem] leading-none">🛠️</div>
      <h1 className="mt-5 font-serif text-[1.5rem] font-semibold text-ink">
        Something went wrong
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
        We couldn&apos;t load this page. Try again — if it keeps happening,
        it&apos;s not you, it&apos;s us.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent px-5 py-2.5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full border border-border-strong bg-surface px-5 py-2.5 text-[0.9375rem] font-medium text-ink transition-colors hover:bg-ink/5"
        >
          Back to feed
        </a>
      </div>
    </main>
  );
}