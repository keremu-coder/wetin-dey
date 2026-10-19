import { notFound, redirect } from "next/navigation";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { canSeePhoto } from "@/lib/photo-visibility";
import { DMThread } from "@/components/DMThread";

export const dynamic = "force-dynamic";

export default async function DMThreadPage(props: {
  params: Promise<{ thread_id: string }>;
}) {
  const params = await props.params;

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

  const [otherProfileRes, myProfileRes, messagesRes, followRes] = await Promise.all([
    db
      .from("sessions")
      .select("handle, text_color, font_preference, avatar_url, photo_visibility")
      .eq("id", otherId)
      .maybeSingle(),
    db
      .from("sessions")
      .select("text_color, font_preference")
      .eq("id", sessionId)
      .maybeSingle(),
    db
      .from("dm_messages")
      .select(
        "id, sender_id, body, filter_level, held, created_at, read_at, media_path, media_type, viewed_at"
      )
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(200),
    db
      .from("follows")
      .select("followed_session_id")
      .eq("follower_session_id", sessionId)
      .eq("followed_session_id", otherId)
      .maybeSingle()
  ]);

  const otherProfile = otherProfileRes.data;
  const otherHandle = otherProfile?.handle ?? "Anonymous";
  const otherColor = otherProfile?.text_color ?? null;
  const otherFont = otherProfile?.font_preference ?? null;

  const canSeeOtherPhoto = canSeePhoto({
    viewerId: sessionId,
    targetId: otherId,
    visibility: otherProfile?.photo_visibility as any,
    isFollowing: !!followRes.data
  });
  const otherAvatarUrl = canSeeOtherPhoto ? (otherProfile?.avatar_url ?? null) : null;

  const myColor = myProfileRes.data?.text_color ?? null;
  const myFont = myProfileRes.data?.font_preference ?? null;

  const messages = (messagesRes.data ?? []).filter((m) => {
    if (!m.held) return true;
    return m.sender_id === sessionId;
  });

  void db
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", thread.id)
    .neq("sender_id", sessionId)
    .is("read_at", null);

  return (
    <DMThread
      threadId={thread.id}
      mySessionId={sessionId}
      otherHandle={otherHandle}
      otherAvatarUrl={otherAvatarUrl}
      myColor={myColor}
      myFont={myFont}
      otherColor={otherColor}
      otherFont={otherFont}
      initialMessages={messages.map((m) => ({
        id: m.id,
        sender_id: m.sender_id,
        body: m.body,
        held: m.held,
        filter_level: m.filter_level,
        read_at: m.read_at,
        created_at: m.created_at,
        media_path: m.media_path,
        media_type: m.media_type,
        viewed_at: m.viewed_at
      }))}
    />
  );
}
