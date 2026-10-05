import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { isMember } from "@/lib/community";
import { ChatRoom } from "./ChatRoom";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params
}: {
  params: { slug: string };
}) {
  const db = createServiceClient();
  const { data: community } = await db
    .from("communities")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!community) return notFound();

  const sessionId = await getSessionId();
  const { member, role } = await isMember(community.id, sessionId);
  const isOwner = role === "owner";
  const canView = community.is_public || member;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link
          href={`/c/${community.slug}`}
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← Back to space
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2rem]">🔒</div>
          <p className="mt-3 font-serif text-[1.1rem] font-semibold text-ink">
            {community.name} is private
          </p>
          <p className="mt-2 text-[0.875rem] text-muted">
            Only members can enter the chat.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ChatRoom
      slug={community.slug}
      name={community.name}
      emoji={community.emoji}
      isMember={member || isOwner}
      isOwner={isOwner}
    />
  );
}