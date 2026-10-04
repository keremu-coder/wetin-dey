import Link from "next/link";
import { HomeFeed } from "@/components/ReportCard";
import { PAGE_SIZE } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";

export const dynamic = "force-dynamic";

const COMMUNITY_TYPES = ["talk_am", "news", "talent", "rant"];

export default async function CommunityPage({
  searchParams
}: {
  searchParams: { page?: string; state?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const db = createServiceClient();

  let q = db
    .from("reports")
    .select("*")
    .in("post_type", COMMUNITY_TYPES)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (searchParams.state) q = q.eq("state", searchParams.state);

  const { data } = await q;
  const posts = ((data ?? []) as Report[]).map((r) => stripSession(r) as Report);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Tab switcher */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <Link
          href="/"
          className="border-b-2 border-transparent px-4 py-3 font-serif text-[1.05rem] font-semibold text-muted transition-colors hover:text-ink"
        >
          Talk Am
        </Link>
        <Link
          href="/community"
          className="border-b-2 border-accent px-4 py-3 font-serif text-[1.05rem] font-semibold text-ink"
        >
          Community
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-ink">
          Community
        </h1>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
          Talent, wins, gist, and everything else. Free form. Support the good
          ones. No tribal or party fights.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <p className="font-serif text-lg text-ink">Community still quiet.</p>
          <p className="mt-1 text-sm text-muted">
            Post something — a win, a talent, a story.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => {
            const title =
              p.agency_canonical || p.agency_raw || p.summary_pidgin?.slice(0, 60) || "Post";
            const blurb = p.summary_pidgin || p.body.slice(0, 200);
            return (
              <Link
                key={p.id}
                href={`/r/${p.id}`}
                className="group relative block rounded-2xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="p-5">
                  <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-wide text-faint">
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-deep">
                      {p.post_type?.replace("_", " ") ?? "post"}
                    </span>
                    <span className="font-mono">
                      {new Date(p.created_at).toLocaleDateString("en-NG", {
                        month: "short",
                        day: "numeric"
                      })}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-[1.35rem] font-semibold leading-tight text-ink transition-colors group-hover:text-accent">
                    {title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-relaxed text-ink/85">
                    {blurb}
                  </p>
                  {p.evidence_url && p.evidence_type === "photo" ? (
                    <img
                      src={p.evidence_url}
                      alt=""
                      className="mt-3 max-h-64 rounded-xl border border-border object-cover"
                    />
                  ) : null}
                  <div className="mt-3 flex items-center gap-2 text-[0.75rem] text-muted">
                    <span>❤️ {p.amount_kobo ? 0 : 0} Support</span>
                    <span>·</span>
                    <span className="capitalize">{p.state}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Link
        href="/submit?tab=community"
        className="mt-10 flex min-h-[52px] items-center justify-center rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-accent-deep hover:shadow-card"
      >
        Post to Community
      </Link>
    </main>
  );
}