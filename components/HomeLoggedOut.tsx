import Link from "next/link";
import { ReportCard } from "./ReportCard";
import type { Report } from "@/lib/types";

// Emoji constants — written as Unicode escapes so the source file contains
// only ASCII. Previous mojibake incidents in this repo were caused by
// literal UTF-8 emoji getting mangled in the file pipeline. Escapes cannot
// be mangled.
const EMOJI = {
  mask: "\uD83C\uDFAD",      // theater masks
  moai: "\uD83D\uDDFF",      // moai statue
  handshake: "\uD83E\uDD1D", // handshake
  globe: "\uD83C\uDF0D",     // globe
  arrow: "\u2192"            // right arrow
};

type Suggestion = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  meta: string;
};

export function HomeLoggedOut({
  reports,
  suggestions
}: {
  reports: Report[];
  suggestions: Suggestion[];
}) {
  return (
    <main className="mx-auto max-w-2xl pb-24">
      {/* HERO */}
      <section className="px-5 pt-10 pb-8">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.15em] text-brand">
          Nigeria, but on the internet.
        </p>
        <h1 className="mt-3 font-serif text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-ink">
          Where Naija dey as one.
        </h1>
        <p className="mt-4 text-[1rem] leading-[1.55] text-muted">
          Your street, your people, your voice. Talk am as e dey happen — no
          status, no shaking, nobody too small. And wetin we talk together no
          dey disappear.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/communities"
            className="flex h-12 items-center justify-center rounded-full bg-brand px-6 text-[1rem] font-semibold text-white"
          >
            Enter your community
          </Link>
          <Link
            href="/talk"
            className="flex h-11 items-center justify-center text-[0.9375rem] font-semibold text-brand"
          >
            See wetin dey happen {EMOJI.arrow}
          </Link>
        </div>
      </section>

      {/* TRUST MARKERS */}
      <section className="px-5 pb-8">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <TrustRow
            emoji={EMOJI.mask}
            label="Anonymous if you want am."
            sub="No number, no wahala. You fit still build your name."
          />
          <TrustRow
            emoji={EMOJI.moai}
            label="E no dey disappear."
            sub="Wetin we don talk remain for public record — today, next year, for the archive."
          />
          <TrustRow
            emoji={EMOJI.handshake}
            label="Nobody too small here."
            sub="Gender, status, background — e no matter for this place."
          />
        </div>
      </section>

      {/* SPACES STRIP */}
      {suggestions.length > 0 ? (
        <section className="pb-8">
          <div className="px-5 pb-3">
            <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-faint">
              Your people dey already wait
            </h2>
          </div>
          <div>
            {suggestions.map((s) => (
              <Link
                key={s.id}
                href={`/c/${s.slug}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink/5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[1.4rem]">
                  {s.emoji ?? EMOJI.globe}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold text-ink">
                    {s.name}
                  </p>
                  <p className="truncate text-[0.75rem] text-muted">{s.meta}</p>
                </div>
                <span className="text-[0.875rem] text-faint" aria-hidden>
                  {EMOJI.arrow}
                </span>
              </Link>
            ))}
          </div>
          <div className="px-5 pt-3">
            <Link
              href="/communities"
              className="text-[0.8125rem] font-medium text-brand"
            >
              See all spaces {EMOJI.arrow}
            </Link>
          </div>
        </section>
      ) : null}

      {/* THE RECORD */}
      {reports.length > 0 ? (
        <section className="pb-8">
          <div className="px-5 pb-3">
            <h2 className="font-serif text-[1.4rem] font-semibold leading-tight text-ink">
              Wetin we don see. Wetin we don settle.
            </h2>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
              This na the community&apos;s public record. Shine your eye — e
              dey here, and e no dey go anywhere.
            </p>
          </div>
          <div className="space-y-3 px-5">
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} currentHandle={null} />
            ))}
          </div>
          <div className="px-5 pt-3">
            <Link href="/talk" className="text-[0.8125rem] font-medium text-brand">
              See the full record {EMOJI.arrow}
            </Link>
          </div>
        </section>
      ) : null}

      {/* HOW E DEY WORK */}
      <section className="px-5 pb-8">
        <h2 className="mb-4 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-faint">
          How e dey work
        </h2>
        <div className="space-y-3">
          <StepRow
            number="1"
            title="Enter."
            body="One minute — no phone number needed."
          />
          <StepRow
            number="2"
            title="Talk."
            body="News, voice note, report, anything when dey happen for your area."
          />
          <StepRow
            number="3"
            title="E remain."
            body="Your voice join the record. Community confam am. E no dey disappear."
          />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-8">
        <div className="rounded-2xl bg-brand p-6 text-center">
          <p className="font-serif text-[1.4rem] font-semibold leading-tight text-white">
            One body. One record. One Naija.
          </p>
          <Link
            href="/communities"
            className="mt-4 flex h-12 items-center justify-center rounded-full bg-white px-6 text-[1rem] font-semibold text-brand"
          >
            Join your people
          </Link>
        </div>
      </section>

      {/* TAG */}
      <p className="px-5 pb-8 text-center text-[0.75rem] leading-relaxed text-faint">
        Wetin Dey — where Naija dey as one, and wetin we talk no dey disappear.
      </p>
    </main>
  );
}

function TrustRow({
  emoji,
  label,
  sub
}: {
  emoji: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-[1.25rem] leading-none" aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="text-[0.9375rem] font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
          {sub}
        </p>
      </div>
    </div>
  );
}

function StepRow({
  number,
  title,
  body
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[0.875rem] font-semibold text-brand">
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
          {body}
        </p>
      </div>
    </div>
  );
}
