import Link from "next/link";

export const metadata = {
  title: "Inbox — Wetin Dey"
};

export default function InboxPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <h1 className="mb-2 font-serif text-[1.5rem] font-semibold text-ink">
        Inbox
      </h1>
      <p className="mb-6 text-[0.875rem] text-muted">
        Direct messages from other members.
      </p>

      <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
        <div className="mb-3 text-[2rem]">✉️</div>
        <p className="font-serif text-[1.05rem] font-semibold text-ink">
          DMs dey come
        </p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
          Direct messaging opens once you have followers and a few posts.
          Contact exchange is filtered for your safety.
        </p>
        <Link
          href="/search"
          className="mt-5 inline-block rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Find people
        </Link>
      </div>
    </main>
  );
}