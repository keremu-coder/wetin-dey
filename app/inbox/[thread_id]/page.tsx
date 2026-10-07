import { notFound, redirect } from "next/navigation";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { DMThread } from "@/components/DMThread";

export const dynamic = "force-dynamic";

export default async function DMThreadPage({
  params
}: {
  params: { thread_id: string };
}) {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/signin");

  const me = await getOrCreateSessionProfile(sessionId);
  if (!me) redirect("/signin");

  const db = createServiceClient();
  const { data: thread } = await db
    .from("dm_threads")
    .select("id, session_a, session_b")
    .eq("id", params.thread_id)
    .maybeSingle();

  if (!thread) return notFound();

  if (thread.session_a !== sessionId && thread.session_b !== sessionId) {
    return notFound();
  }

  const otherId =
    thread.session_a === sessionId ? thread.session_b : thread.session_a;

  const { data: otherProfile } = await db
    .from("sessions")
    .select("handle")
    .eq("id", otherId)
    .maybeSingle();

  return (
    <DMThread
      threadId={thread.id}
      mySessionId={sessionId}
      otherHandle={otherProfile?.handle ?? "Anonymous"}
    />
  );
}