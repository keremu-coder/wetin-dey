import Link from "next/link";
import { getSessionId } from "@/lib/session";
import { getChatsHome } from "@/lib/chats-data";
import { createServiceClient } from "@/lib/supabase/server";
import { ChatRow } from "@/components/ChatRow";
import { SectionHeader } from "@/components/SectionHeader";
import { SuggestionRow } from "@/components/SuggestionRow";
import { HomeLoggedOut } from "@/components/HomeLoggedOut";
import { ChoosePath } from "@/components/ChoosePath";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessionId = await getSessionId();
  const { chats, suggestions } = await getChatsHome(sessionId);

  // A visitor with zero chats gets the identity hero regardless of
  // whether the middleware already minted them an anonymous session
  // cookie (it always does). The signal for "new user" is "no chats",
  // not "no session". Once they join their first space, they never
  // see the hero again — this is the whole point of Direction A.
  if (chats.length === 0) {
    const db = createServiceClient();

    const { data: recentReports } = await db
      .from("reports")
      .select(
        "id, created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo, evidence_url, evidence_type, evidence_link, evidence_label, summary_pidgin, summary_english, incident_date, status, reviewed, author_handle, post_type, upvotes, downvotes, me_too_count, comment_count, evidence_tier, target_type, community_id"
      )
      .eq("reviewed", true)
      .eq("held", false)
      .in("post_type", ["report_am", "ask", "help"])
      .is("community_id", null)
      .order("created_at", { ascending: false })
      .limit(20);

    // Push resolved reports to the front, then take 3. Resolved is the
    // emotional peak — a visitor landing on the homepage should see
    // "wetin we don settle" first, not just the outrage feed.
    const sorted = [...((recentReports ?? []) as Report[])].sort((a, b) => {
      const aResolved = a.status === "resolved";
      const bResolved = b.status === "resolved";
      if (aResolved && !bResolved) return -1;
      if (bResolved && !aResolved) return 1;
      return 0;
    });

    return (
      <HomeLoggedOut
        reports={sorted.slice(0, 3)}
        suggestions={suggestions.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          emoji: s.emoji ?? null,
          meta: s.meta
        }))}
      />
    );
  }

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

      <SectionHeader
        title="Chats"
        action={{ label: "New space", href: "/communities/new" }}
      />
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
