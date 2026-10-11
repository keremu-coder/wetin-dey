import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  member_count: number;
  post_count: number;
};

/**
 * Featured spaces. Six hand-picked public rooms seeded by the platform
 * for discovery. Order is fixed (not by member count) so the visual
 * rhythm is stable. Each has a short pitch shown on the card.
 *
 * The seed migration (015) creates rows with these exact slugs. If a
 * row is missing from the DB, it is simply not rendered — no fallback.
 */
const FEATURED: {
  slug: string;
  name: string;
  emoji: string;
  pitch: string;
}[] = [
  {
    slug: "naija-market",
    name: "Naija Market",
    emoji: "🛒",
    pitch: "Buy, sell, find. Anywhere in Naija."
  },
  {
    slug: "gist-entertainment",
    name: "Gist & Entertainment",
    emoji: "🎬",
    pitch: "The gist no dey finish. Music, Nollywood, comedy."
  },
  {
    slug: "gamers-lounge",
    name: "Gamers Lounge",
    emoji: "🎮",
    pitch: "FIFA, COD, eSports, mobile. Squad up."
  },
  {
    slug: "job-hustle",
    name: "Job & Hustle",
    emoji: "💼",
    pitch: "Openings, side hustles, gig work. No gatekeeping."
  },
  {
    slug: "food-kitchen",
    name: "Food & Kitchen",
    emoji: "🍲",
    pitch: "Recipes, spots, plating. From mama's pot."
  },
  {
    slug: "love-life",
    name: "Love & Life",
    emoji: "💬",
    pitch: "Real talk. Relationships, family, the quiet things."
  }
];

function spaceGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const palettes = [
    "linear-gradient(135deg, #1F7A4D 0%, #14532d 100%)",
    "linear-gradient(135deg, #C0392B 0%, #7f1d1d 100%)",
    "linear-gradient(135deg, #7C3AED 0%, #4c1d95 100%)",
    "linear-gradient(135deg, #0E7490 0%, #164e63 100%)",
    "linear-gradient(135deg, #D97706 0%, #92400e 100%)",
    "linear-gradient(135deg, #BE185D 0%, #831843 100%)",
    "linear-gradient(135deg, #4D7C0F 0%, #365314 100%)",
    "linear-gradient(135deg, #A16207 0%, #713f12 100%)"
  ];
  return palettes[Math.abs(h) % palettes.length];
}

export default async function CommunitiesPage() {
  const db = createServiceClient();
  const { data: communities } = await db
    .from("communities")
    .select("id, slug, name, description, emoji, member_count, post_count")
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .limit(50);

  const all = (communities ?? []) as Community[];
  const bySlug = new Map(all.map((c) => [c.slug, c]));

  // Only render featured cards for spaces that actually exist in the DB.
  const featured = FEATURED.map((f) => ({
    ...f,
    row: bySlug.get(f.slug) ?? null
  })).filter((f) => f.row !== null);


  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-ink">
            Spaces
          </h1>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
            Your village, your game squad, your church cell, your family.
            Voice notes and text, like WhatsApp — but no phone number needed.
          </p>
        </div>
        <Link
          href="/communities/new"
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          + Create
        </Link>
      </div>

      {featured.length > 0 ? (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-[1.15rem] font-semibold text-ink">
              Featured
            </h2>
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
              Pick one. Say hi.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {featured.map((f) => {
              const gradient = spaceGradient(f.slug);
              const members = f.row?.member_count ?? 0;
              return (
                <Link
                  key={f.slug}
                  href={`/c/${f.slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong"
                >
                  <div
                    className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-[2rem] shadow-sm"
                    style={{ background: gradient }}
                  >
                    <span style={{ filter: "saturate(1.2)" }}>{f.emoji}</span>
                  </div>

                  <p className="font-serif text-[1rem] font-semibold leading-tight text-ink">
                    {f.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-muted">
                    {f.pitch}
                  </p>

                  <p className="mt-auto pt-3 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                    {members === 0
                      ? "Be the first →"
                      : `${members} member${members === 1 ? "" : "s"} →`}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {featured.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="text-[2.5rem]">👥</div>
          <p className="mt-3 font-serif text-[1.2rem] font-semibold text-ink">
            No public spaces yet
          </p>
          <p className="mt-1 text-[0.875rem] text-muted">
            Be the first. Create one — takes 10 seconds.
          </p>
          <Link
            href="/communities/new"
            className="mt-5 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Create a space
          </Link>
        </div>
      ) : null}
    </main>
  );
}