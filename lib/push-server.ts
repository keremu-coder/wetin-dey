import "server-only";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:support@wetindey.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subj, pub, priv);
  vapidReady = true;
  return true;
}

type PushTarget = {
  session_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPushToSessions(
  sessionIds: string[],
  payload: { title: string; body: string; tag?: string; url?: string }
): Promise<void> {
  if (sessionIds.length === 0) return;
  if (!ensureVapid()) return;

  const { data, error } = await sb()
    .from("push_subscriptions")
    .select("session_id, endpoint, p256dh, auth")
    .in("session_id", sessionIds);

  if (error || !data) return;

  const targets = data as PushTarget[];
  const deadEndpoints: string[] = [];

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: t.endpoint,
            keys: { p256dh: t.p256dh, auth: t.auth }
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            tag: payload.tag ?? "wetindey",
            url: payload.url ?? "/"
          })
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadEndpoints.push(t.endpoint);
        }
      }
    })
  );

  if (deadEndpoints.length > 0) {
    await sb()
      .from("push_subscriptions")
      .delete()
      .in("endpoint", deadEndpoints);
  }
}

export async function notifyCommunityMembers(params: {
  communityId: string;
  senderSessionId: string;
  senderHandle: string;
  communityName: string;
  communitySlug: string;
  body: string | null;
  hasAudio: boolean;
}): Promise<void> {
  const {
    communityId,
    senderSessionId,
    senderHandle,
    communityName,
    communitySlug,
    body,
    hasAudio
  } = params;

  const { data: members, error } = await sb()
    .from("community_members")
    .select("session_id")
    .eq("community_id", communityId);

  if (error || !members) return;

  const recipients = (members as Array<{ session_id: string }>)
    .map((m) => m.session_id)
    .filter((id) => id && id !== senderSessionId);

  if (recipients.length === 0) return;

  const preview = body
    ? body.slice(0, 90)
    : hasAudio
      ? "🎤 Voice note"
      : "New message";

  await sendPushToSessions(recipients, {
    title: `${senderHandle} in ${communityName}`,
    body: preview,
    tag: `chat-${communityId}`,
    url: `/c/${communitySlug}/chat`
  });
}

export async function notifyDMRecipient(params: {
  recipientSessionId: string;
  senderHandle: string;
  threadId: string;
  body: string;
}): Promise<void> {
  const { recipientSessionId, senderHandle, threadId, body } = params;

  // Skip push if the recipient was active in the last 30 seconds.
  // Reduces notification spam during active conversation.
  try {
    const { data: recipient } = await sb()
      .from("sessions")
      .select("last_seen_at")
      .eq("id", recipientSessionId)
      .maybeSingle();

    if (recipient?.last_seen_at) {
      const age = Date.now() - new Date(recipient.last_seen_at).getTime();
      if (age < 30 * 1000) return;
    }
  } catch {
    /* ignore */
  }

  const preview = body.length > 90 ? body.slice(0, 90) + "…" : body;

  await sendPushToSessions([recipientSessionId], {
    title: `@${senderHandle} sent you a message`,
    body: preview,
    tag: `dm-${threadId}`,
    url: `/inbox/${threadId}`
  });
}