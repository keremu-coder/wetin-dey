import Link from "next/link";
import { getSessionId } from "@/lib/session";
import { getChatsHome } from "@/lib/chats-data";
import { ChatRow } from "@/components/ChatRow";
import { SectionHeader } from "@/components/SectionHeader";
import { SuggestionRow } from "@/components/SuggestionRow";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessionId = await getSessionId();
  const { chats, suggestions } = await getChatsHome(sessionId);

  return (
    <main className="mx-auto max-w-2xl pb-24">
      <div className="px-5 pb-3 pt-2">
        <Link
          href="/search"
          className="flex h-12 items-center gap-3 rounded-[24px] bg-surface2 px-4 text-[1rem] leading-[1.5rem] text-muted"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Search spaces and people</span>
        </Link>
      </div>

      {chats.length > 0 ? (
        <>
          <SectionHeader title="Chats" action={{ label: "New space", href: "/communities/new" }} />
          <div>
            {chats.map((c, i) => (
              <ChatRow
                key={c.key}
                href={c.href}
                name={c.name}
                seed={c.seed}
                emoji={c.emoji}
                avatarUrl={c.avatarUrl}
                signal={c.signal}
                preview={c.preview}
                previewPrefix={c.previewPrefix}
                voice={c.voice}
                receipt={c.receipt}
                timestamp={c.timestamp}
                unread={c.unread}
                isLast={i === chats.length - 1}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-[280px] px-5 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-3xl bg-primary-tint">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary-ink" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-[1.0625rem] font-semibold leading-[1.375rem] text-ink">Your people dey here</p>
          <p className="mt-2 text-[1rem] leading-[1.5rem] text-muted">
            Join a space or start one for your family, church cell, estate or friends. Send voice notes, share news, no phone number needed.
          </p>
          <Link href="/communities/new" className="mt-6 flex h-12 items-center justify-center rounded-full bg-primary px-6 text-[1rem] font-semibold text-white">
            Start a space
          </Link>
          <Link href="/communities" className="mt-2 flex h-11 items-center justify-center text-[0.9375rem] font-semibold text-primary-ink">
            Browse public spaces
          </Link>
        </div>
      )}

      {suggestions.length > 0 ? (
        <>
          <SectionHeader title="Spaces you might like" />
          <div>
            {suggestions.map((s, i) => (
              <SuggestionRow
                key={s.id}
                href={`/c/${s.slug}`}
                name={s.name}
                seed={s.slug}
                emoji={s.emoji}
                meta={s.meta}
                isLast={i === suggestions.length - 1}
              />
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}